import OpenAI from "openai";
import JSON5 from "json5";

const openai = new OpenAI({apiKey: process.env.NEXT_PUBLIC_OPEN_AI_KEY, dangerouslyAllowBrowser: true});
const annotateVectorID = process.env.NEXT_PUBLIC_ANNOTATE_VECTOR_STORE;
const purposeVectorID = process.env.NEXT_PUBLIC_PURPOSE_VECTOR_STORE;

const maxAnnotationQueue = 2;
const maxPurposeQueue = 3;
let annotationQueue = 0;
let purposeQueue = 0;

export async function findAnnotations(purpose, callback, endCallback, n=8) {
    if (annotationQueue >= maxAnnotationQueue) {
        console.log("Annotation queue is full. Waiting for a spot...");
        await new Promise(r => setTimeout(r, 1000));
        return findAnnotations(purpose, callback, endCallback, n);
    }
    annotationQueue++;

    try {
        let textDeltaArray = [];
        let totalRuns = 0;
        let maxRuns = Math.max(3, n);

        if (annotateVectorID) {
            let vectorStore = await openai.vectorStores.retrieve(annotateVectorID);
            console.log("Checking vector store status...", vectorStore.status);
        
            while (vectorStore.status !== "completed") {
                await new Promise(r => setTimeout(r, 1000));
                vectorStore = await openai.vectorStores.retrieve(annotateVectorID);
                console.log("Checking vector store status...", vectorStore.status);
            }
        } else {
            console.log("Vector store is not available");
            return;
        }
        console.log("Running GPT-4...");
        
        let executeRun = (prevID = null, followUpPrompt = null) => {
            let newTextDeltaArray = [];
            totalRuns++;

            try {
                let stream = openai.responses.stream({
                    model: "gpt-4o-2024-11-20",
                    store: true,
                    tool_choice: "auto",
                    truncation: "auto",
                    stream: true,
                    previous_response_id: prevID,
                    tools: [{
                        type: "file_search",
                        vector_store_ids: [annotateVectorID],
                    }],
                    instructions: "You are an expert at annotating documents. The user has annotated the document I have given you. Given the purpose of an annotation, you will find all sentences in the document that could be annotated for the same purpose. Do not change the sentence from the document in any way. Give one sentence in one annotation. Describe your steps first. Do not ask follow-up questions.",
                    input: followUpPrompt ? [
                        {
                            role: "user",
                            content: followUpPrompt
                        }
                    ] : 
                    [{ 
                        role: "user",
                        content: `You are an expert in English grading an English test with 8 questions. Read every page and find sentences that could be annotated with:

"${purpose}"

Here is a step-by-step list for annotating a document:

1. Describe what details in sentences to look for in the document. Be specific. Do not change the original purpose in any way. If the purpose is word/phrase-specific, describe the specific word or phrase to look for that is in the purpose.
2. Explain why you annotated the sentence.
3. Suggest fixes for the sentence by describing the fix without giving the answer.
4. Combine the explanation and suggestion without quoting the sentence using less than 20 words.
5. Do not include any sentences that need no modification or annotation.
6. Make a list of sentences for each response using triple asterisks for sentences and double curly braces for the explanation and suggestion. For example:

## Response <number>

*** <sentence> ***
{{ <explanation and suggestion> }}
...

7. For each sentence, you can optionally target words in the sentence to annotate and give specific feedback to. If you do, list the words or phrases to look for in the sentence, separated by commas and enclosed by triple quotation marks. For example:

## Response <number>

*** <sentence> ***
""" <words or phrase to look for (e.g. <word/phrase 1>, <word/phrase 2>)> """
{{ <explanation and suggestion> }}
...

Make sure you have all the sentences needed to be annotated in the format above.`
                    },
                    { 
                        role: "user",
                        content: `Walk me through one question at a time in manageable parts step by step, summarizing and analyzing as we go to make sure we have all the sentences needed to be annotated`
                    }],
                }, {
                    maxRetries: 3,
                });

                stream
                .on("error", (error) => {
                    console.log("error", error);
                    totalRuns--;
                    setTimeout(() => executeRun(prevID, followUpPrompt), 1000);
                })
                .on("response.output_text.delta", (diff) => {
                    textDeltaArray.push(diff.delta);
                    newTextDeltaArray.push(diff.delta);
        
                    if (callback instanceof Function)
                        callback(diff.delta);
                })
                .on("response.completed", async (event) => {    
                    if (followUpPrompt || totalRuns >= maxRuns) {
                        if (newTextDeltaArray.join("").toLowerCase().includes(`yes`) || totalRuns >= maxRuns) {

                            if (textDeltaArray.length === 0) {
                                findAnnotations(purpose, callback, endCallback);
                            } else if (endCallback instanceof Function) {
                                endCallback(textDeltaArray);
                            }
                            annotationQueue--;
                            return;
                        } else if (!newTextDeltaArray.join("").toLowerCase().includes(`{{`)) {
                            executeRun(event.response.id, `Please proceed marking all ${n} questions without repeating previous sentences. Make sure all sentences are found for each question. Respond with "yes" if you are done.`);
                            return;
                        }
                    }
                    executeRun(event.response.id, `Have you finished marking all ${n} questions? Respond with "yes" if you are done. Otherwise continue marking until all ${n} questions are marked without repeating previous sentences. Make sure all sentences are found for each question.`);
                });
            } catch (error) {
                console.log("error", error);
                executeRun(prevID, followUpPrompt);
            }
        };
        executeRun();
    } catch (error) {
        console.log("error", error);
        annotationQueue--;
    }
}

export async function makeInference(image1, image2, type, annotatedText, specific=false) {
    if (purposeQueue >= maxPurposeQueue) {
        console.log("Purpose queue is full. Waiting for a spot...");
        await new Promise(r => setTimeout(r, 1000));
        return await makeInference(image1, image2, type, annotatedText, specific);
    }
    let typeAnnotatedText = "";
    purposeQueue++;

    if (annotatedText instanceof Array) {
        for (let i = 0; i < annotatedText.length; i++) {
            typeAnnotatedText += `${type[i]} "${annotatedText[i]}"`;

            if (i === annotatedText.length - 2) {
                typeAnnotatedText += ", and ";
            } else if (i < annotatedText.length - 2) {
                typeAnnotatedText += ", ";
            }
        }
    } else {
        typeAnnotatedText = `${type} "${annotatedText}"`;
    }
    
    return new Promise(async (resolve, reject) => {
        try {
            let criteria = specific
                ? `6. Give two different guesses of the purpose using different personas and past annotation history. The purposes should have different themes and relate to the context.
7. For each guess, give two levels of detail: specific and broad. When describing with specific, describe the purpose so it is specific to the words of the annotated text. When describing with broad, use umbrella terms without using the annotated text.`
                : `6. Give four different guesses of the purpose using different personas and past annotation history. The purposes should have different themes and relate to the context.`;

            let formatCriteria = specific
                ? `{
    "annotationDescription": "<annotation description>",
    "pastAnnotationHistory": "<annotation history>",
    "purpose": [
        {
            "persona": "<persona 1>",
            "purpose": "<broad_purpose 1>",
            "purposeTitle": "<broad_purpose_title 1>"
        },
        {
            "persona": "<persona 2>",
            "purpose": "<broad_purpose 2>",
            "purposeTitle": "<broad_purpose_title 2>"
        },
        {
            "persona": "<persona 1>",
            "purpose": "<specific_purpose 1>",
            "purposeTitle": "<specific_purpose_title 1>"
        },
        {
            "persona": "<persona 2>",
            "purpose": "<specific_purpose 2>",
            "purposeTitle": "<specific_purpose_title 2>"
        }
    ]
}

<annotation description>: is a detailed description of the annotation.
<annotation history>: is a detailed annotation history related to the annotation.
<broad_purpose>: is a broader description of the <specific_purpose> without using the <annotation description>. The purpose should talk about the text as a whole. Talk in the second person (you, your, etc.) without mentioning the persona. Be specific and use as few words as possible.
<specific_purpose>: is a description of the annotation purpose and annotation type using <annotation description> and <annotation history> as context. Talk in the second person (you, your, etc.) without mentioning the persona. After, the purpose must state "The purpose only looks for <words/phrases of the annotated text>...". Be specific and use as few words as possible.
<broad_purpose_title>: is a short title for <broad_purpose> without mentioning the persona, be very specific.
<specific_purpose_title>: is a short title for <specific_purpose> without mentioning the persona, be very specific. It should have the same wording as <broad_purpose_title>, but the title must be word-specific or phrase-specific by having the annotated text in the title.`
            :  `{
    "annotationDescription": "<annotation description>",
    "pastAnnotationHistory": "<annotation history>",
    "purpose": [
        {
            "persona": "<persona 1>",
            "purpose": "<purpose 1>",
            "purposeTitle": "<purpose_title 1>"
        },
        {
            "persona": "<persona 2>",
            "purpose": "<purpose 2>",
            "purposeTitle": "<purpose_title 2>"
        },
        {
            "persona": "<persona 3>",
            "purpose": "<purpose 3>",
            "purposeTitle": "<purpose_title 3>"
        },
        {
            "persona": "<persona 4>",
            "purpose": "<purpose 4>",
            "purposeTitle": "<purpose_title 4>"
        },
    ]
}

<annotation description>: is a detailed description of the annotation.
<annotation history>: is a detailed annotation history related to the annotation.
<purpose>: is a description of the annotation purpose and annotation type using the <annotation history> as context without using the <annotation description> and any words in the annotated text. Talk in second person (you, your, etc.). Be specific and use as few words as possible.
<purpose_title>: is a short title for <purpose> without mentioning the persona, be very specific.`;
            
            if (purposeVectorID) {
                let vectorStore = await openai.vectorStores.retrieve(purposeVectorID);
                console.log("Checking vector store status...", vectorStore.status);

                while (vectorStore.status !== "completed") {
                    await new Promise(r => setTimeout(r, 1000));
                    vectorStore = await openai.vectorStores.retrieve(purposeVectorID);
                    console.log("Checking vector store status...", vectorStore.status);
                }
            } else {
                console.log("Vector store is not available");
            }
            console.log("Running GPT-4 Vision...");

            let stream = openai.responses.stream({
                store: false,
                stream: true,
                model: "gpt-4o-mini-2024-07-18",
                tool_choice: "required",
                truncation: "auto",
                tools: [{
                    type: "file_search",
                    vector_store_ids: [purposeVectorID],
                }],
                instructions: "You are an expert in describing annotations and determining their purpose. You will be shown two images of annotations from a document a user has personally annotated. The first image shows the annotation with the document, and the second shows the annotation without the document. Do not give vague answers, such as whether the user is interested in or emphasizing the text; be very specific.",
                input: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "input_text",
                                text: `Types of annotation:
- circles or boxes
- underlining
- highlighting
- crossing out
- handwritten notes/text (write out what the note/text says)
- punctuation marks (e.g., commas, periods, question marks, asterisks, etc.), choose which one
- arrows
- brackets, angle brackets, or braces

Here are the steps:
1. Describe the annotation by reviewing the list of annotation types for possibilities.
2. Guess the purpose of the annotation based on the context. Be very specific and detailed.
3. Use ${specific ? "two": "four"} branches of thinking such as backtracking to check for any other possibilities.
4. Look at past annotation history in your knowledge base.
5. Summarize your past findings and relate them to the annotation.
${criteria}`
                            },
                            {
                                type: "input_image",
                                image_url: image1,
                            },
                            {
                                type: "input_image",
                                image_url: image2,
                            },
                        ],
                    },
                    {
                        role: "user",
                        content: `Context: The user is marking an English test in red pen strokes and has ${typeAnnotatedText}.`
                    },
                    {
                        role: "user",
                        content: `Describe your steps first using your step-by-step list then, parse your response as a JSON object in this format:\n${formatCriteria}`
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "input_text",
                                text: "Let's work this out in a step by step way to be sure we have described the annotation in the context of past history and determined thematically different purposes that matches the user's context (The user is marking an English test)."
                            }
                        ],
                    }
                ],
            }, {
                maxRetries: 3,
            });

            let textDeltaArray = [];

            stream
            .on("response.output_text.delta", (diff) => {
                textDeltaArray.push(diff.delta);
            })
            .on("response.completed", (event) => {
                let response = event.response;

                if (response.status === "completed") {
                    let regex = /\{(\s|.)*\}/g;
            
                    let match = (textDeltaArray.join("")).match(regex);
                    console.log(JSON5.parse(match[0]));

                    let checkResult = JSON5.parse(match[0]);

                    if (!checkResult.annotationDescription || !checkResult.pastAnnotationHistory || !checkResult.purpose || checkResult.purpose.length < 4) {
                        throw new Error("Missing required fields in the response.");
                    }

                    for (let purpose of checkResult.purpose) {
                        if (!purpose.persona || !purpose.purpose || !purpose.purposeTitle) {
                            throw new Error("Missing required fields in the response.");
                        }
                    }
                    purposeQueue--;
                    resolve({ rawText: JSON.stringify(response.output), result: checkResult });
                } else {
                    throw new Error("No text response found.");
                }
            });
        } catch (error) {
            console.error(error);
            purposeQueue--;
        }
    });
}