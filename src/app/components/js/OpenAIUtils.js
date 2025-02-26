/* eslint-disable indent */
/* eslint-disable no-unreachable */
/* eslint-disable no-unused-vars */
import OpenAI from "openai";
import JSON5 from "json5";
import * as data from "./TestData";
import * as img from "./TestImg";

const openai = new OpenAI({apiKey: process.env.NEXT_PUBLIC_OPEN_AI_KEY, dangerouslyAllowBrowser: true});

const assistantAnnotateID = process.env.NEXT_PUBLIC_ASSISTANT_ANNOTATE_ID;
const assistantPurposeID = process.env.NEXT_PUBLIC_ASSISTANT_PURPOSE_ID;
const maxAnnotationQueue = 2;
const maxPurposeQueue = 3;
let annotationQueue = 0;
let purposeQueue = 0;
let iteration = 0;

// makeInference(noNoteTest, noNoteTestCrop, "circled", "TOUCH FREE CAMERA MENTAL COMMANDS AND HAND GESTURES").catch(console.error);
// makeInference(test, cropTest, "circled", "TOUCH FREE CAMERA MENTAL COMMANDS AND HAND GESTURES").catch(console.error);
// makeInference(img.img1, img.img2, "underlined", "utilizes").catch(console.error);
// makeInference(img.img7, img.img8, "circled", "8 ] utilizes").catch(console.error);
// makeInference(img.img5, img.img6, "annotated (not circled, underlined or highlighted)", "(i.e.").catch(console.error).then(console.log);
// makeInference(img.img9, img.img10, "underlined", "the prospective cycles of your education life.").catch(console.error).then(console.log);
// makeInference(img.img11, img.img12, ["crossed", "circled"], ["all", "he"], true).catch(console.error).then(console.log);
// makeInference(img.img13, img.img14, ["circled"], ["extol"], true).catch(console.error).then(console.log);
// makeInference(img.img15, img.img15, ["circled"], ["spiked"], true).catch(console.error).then(console.log);
// makeInference(img.img16, img.img17, ["circled"], ["to 18 subjects."], false).catch(console.error).then(console.log);

// "Enhanced Appeal": "A peer reviewer might have indicated the title as 'Better' because it effectively captures interest and reflects the cutting-edge nature of the research, enhancing the document's appeal."


// findAnnotations(`"Engage Technology Audience": "The aim is to capture the attention of an audience interested in innovative technologies, suggesting a more dynamic or precise title to better engage readers."`)
// findAnnotations(`"Clarify Academic Focus": "The suggestion aims to refine the title to more effectively convey the primary focus or uniqueness of the work, potentially increasing its clarity and academic appeal."`)
// findAnnotations(`The word 'utilizes' is underlined, and there is a handwritten note beside it suggesting to 'replace with 'use''. "Simplification of Vocabulary": "The editor has underlined the word to suggest a simpler or more direct vocabulary in the manuscript, which may help in making the text more accessible and easier to understand."`)
// findAnnotations(`"Literature Review"`)
// findAnnotations(`"Syntactic Errors: Look for misplaced modifiers, incorrect verb forms, or run-on sentences"`)
// findAnnotations(`"Grammar/Usage Correction: Word-Specific: You have circled 'extol' because you are questioning the student's correct usage of the word. The circle and the question mark suggest either a grammatical context or if 'extol' is appropriately used in the sentence."`)
// findAnnotations(`"Grammar/Usage Correction: You are analyzing and ensuring correct grammar or appropriate usage of terms within the text. This involves reviewing language and its functionality in sentences broadly."`)
// findAnnotations(`Ensuring Gender-Inclusive Language (word-specific): You are testing the grammatical appropriateness of using 'he' by suggesting possible corrections to align the pronouns in the text with gender neutrality or specificity, as deemed fitting by the context.`)
// findAnnotations(`Ensuring Gender-Inclusive Language: You are promoting gender-neutral or inclusive language use in textual representations, enabling broader interpretations and engagement with the text in terms of gender sensitivity.`)
// findAnnotations(`Highlighting vocabulary misuse deductive: You circle vocabulary misuse for scoring consistently and identify written errors in clear, direct terms to deduct marks where necessary.`)

// openai.files.list().then((files) => {
//     console.log("Files", files);

//     files.data.forEach((file) => {
//         if (file.filename === "history.txt") {
//             openai.files.del(file.id).then((res) => {
//                 console.log("Deleted file", res);
//             });
//         }

//         if (file.purpose === "vision" && file.filename === "image.png") {
//             openai.files.del(file.id).then((res) => {
//                 console.log("Deleted file", res);
//             });
//         }
//     });
// });

export async function findAnnotations(purpose, callback, endCallback, n=8) {
    if (annotationQueue >= maxAnnotationQueue) {
        console.log("Annotation queue is full. Waiting for a spot...");
        await new Promise(r => setTimeout(r, 1000));
        return findAnnotations(purpose, callback, endCallback, n);
    }
    annotationQueue++;
    console.log(purpose);
    
    if (!process.env.NEXT_PUBLIC_VERCEL_ENV && process.env.NODE_ENV === "development") {
        let message = "";
        // await new Promise(r => setTimeout(r, 3000));
        let rand = Math.floor(Math.random() * 2);
        let test = rand === 0 ? data.duplicateTest1 : data.duplicateTest3;
        let dataTest = iteration % 2 === 0 ? data.test26 : data.test25;
        iteration++;

        for (let token of dataTest) {
            // console.log(token);
            // await new Promise(r => setTimeout(r, 0.1));
            message += token;

            if (callback instanceof Function) {
                callback(token);
            }
        }
        // await new Promise(r => setTimeout(r, 8000));

        if (endCallback instanceof Function)
            endCallback();

        console.log(message);
        annotationQueue--;
        return;
    }

    try {
        const thread = await openai.beta.threads.create();
        let textDeltaArray = [];

        await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
`You are an expert in English grading an English test with 8 questions. Read every page and find sentences that could be annotated with:

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
        });

        await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
            `Walk me through one question at a time in manageable parts step by step, summarizing and analyzing as we go to make sure we have all the sentences needed to be annotated`
        });

        let totalRuns = 0;
        let maxRuns = Math.max(3, n);

        const annotateAssistant = await openai.beta.assistants.retrieve(assistantAnnotateID);
        const vectorStoreID = annotateAssistant.tool_resources.file_search.vector_store_ids[0];
        
        if (vectorStoreID) {
            let vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreID);
            console.log("Checking vector store status...", vectorStore.status);
        
            while (vectorStore.status !== "completed") {
                await new Promise(r => setTimeout(r, 1000));
                vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreID);
                console.log("Checking vector store status...", vectorStore.status);
            }
        } else {
            console.log("Vector store is not available");
            return;
        }
        console.log("Running GPT-4o...");
        // return;

        let runNumber = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];

        let executeRun = (checkFinish) => {
            let newTextDeltaArray = [];
            totalRuns++;

            try {
                const run = openai.beta.threads.runs.stream(thread.id, {
                    assistant_id: assistantAnnotateID,
                    tool_choice: { type: "file_search" },
                    max_completion_tokens: 2048
                    
                })
                .on("error", (error) => {
                    console.log("error", error);
                    totalRuns--;
                    setTimeout(() => executeRun(checkFinish), 1000);
                })
                // .on('textCreated', (text) => console.log('\nassistant > '))
                .on("textDelta", (textDelta, snapshot) => {
                    textDeltaArray.push(textDelta.value);
                    newTextDeltaArray.push(textDelta.value);
        
                    if (callback instanceof Function)
                        callback(textDelta.value);
                    // console.log(textDelta.value)
                })
                .on("end", async () => {
                    // console.log(newTextDeltaArray.join(""));
                    // console.log("Stream ended");
                    // console.log(textDeltaArray);

                    // if (endCallback instanceof Function)
                    //     endCallback(textDeltaArray);
                    // return;
                    
                    console.log(newTextDeltaArray.join(""));
    
                    if (checkFinish || totalRuns >= maxRuns) {
                        if (newTextDeltaArray.join("").toLowerCase().includes(`yes`) || totalRuns >= maxRuns) {
                            console.log("Stream ended");
                            console.log(textDeltaArray);

                            if (textDeltaArray.length === 0) {
                                findAnnotations(purpose, callback, endCallback);
                            } else if (endCallback instanceof Function) {
                                endCallback(textDeltaArray);
                            }
                            annotationQueue--;
                            return;
                        } else if (!newTextDeltaArray.join("").toLowerCase().includes(`{{`)) {
                            await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
                                `Please proceed marking all ${n} questions without repeating previous sentences. Make sure all sentences are found for each question. Respond with "yes" if you are done.`
                            });
    
                            executeRun(true);
                            return;
                        }
                    }
    
                    await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
                        `Have you finished marking all ${n} questions? Respond with "yes" if you are done. Otherwise continue marking until all ${n} questions are marked without repeating previous sentences. Make sure all sentences are found for each question.`
                    })
                    .catch((error) => {
                        throw error;
                    });
    
                    executeRun(true);
                });
            } catch (error) {
                console.log("error", error);
                executeRun(checkFinish);
            }
        };
        executeRun(false);
    } catch (error) {
        console.log("error", error);
        annotationQueue--;
        
        await new Promise(r => setTimeout(r, 1000));
        findAnnotations(purpose, callback, endCallback);
    }
}

export async function makeInference(image1, image2, type, annotatedText, specific=false) {
    if (purposeQueue >= maxPurposeQueue) {
        console.log("Purpose queue is full. Waiting for a spot...");
        await new Promise(r => setTimeout(r, 1000));
        return await makeInference(image1, image2, type, annotatedText, specific);
    }
    let file1, file2;
    let typeAnnotatedText = "";
    purposeQueue++;
    
    console.log(image1, image2);
    console.log(type, annotatedText, specific);

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
    console.log(typeAnnotatedText);
    
    if (!process.env.NEXT_PUBLIC_VERCEL_ENV && process.env.NODE_ENV === "development") {
        return new Promise(
            resolve => {
                setTimeout(() => {
                    console.log("Resolving promise...");
                    purposeQueue--;

                    resolve({
                        rawText: "Bla bla bla...",
                        result: JSON.parse(`{
                            "annotationDescription": "The annotation includes a circular mark around the word 'spiked' and handwritten text reading 'incorrect word usage.' It is denoting a specific issue in word choice within the context of an English test.",
                            "pastAnnotationHistory": "No annotation history exists specifically for the word 'spiked' or other markings of incorrect word usage in English tests. The inferred historical context is tied to educational contexts where such annotations are meant to provide correction and learning guidance.",
                            "purpose": [
                                {
                                    "persona": "pedagogical correction-care",
                                    "purpose": "You focus on pointing out and explaining nuanced word misuse for better student comprehension. Attention is on promoting precise, contextually suitable vocabulary in analytical or creative work.",
                                    "purposeTitle": "Pointing out precise word misuse"
                                },
                                {
                                    "persona": "formal evaluative grading",
                                    "purpose": "You circle vocabulary misuse for scoring consistently and identify written errors in clear, direct terms to deduct marks where necessary.",
                                    "purposeTitle": "Highlighting vocabulary misuse deductive"
                                },
                                {
                                    "persona": "pedagogical correction-care",
                                    "purpose": "You point out the issue with 'spiked' to explain that its usage is improper for the context and help students practice accurate vocabulary. The purpose only looks for 'spiked' and encourages correction with comments.",
                                    "purposeTitle": "Pointing out precise word misuse with 'spiked'"
                                },
                                {
                                    "persona": "formal evaluative grading",
                                    "purpose": "You highlight 'spiked' as a clear vocabulary mistake and deduct marks for inappropriate usage in an evaluative context. The purpose only looks for 'spiked' to ensure students avoid similar errors.",
                                    "purposeTitle": "Highlighting vocabulary misuse deductive with 'spiked'"
                                }
                            ]
                        }`)
                    });
                }, 1000);
            } 
        );
    }
    
    return new Promise(async (resolve, reject) => {
        try {
            async function getFile(image) {
                function dataURLtoFile(dataurl, filename) {
                    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
                        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
                    while (n--) {
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    return new File([u8arr], filename, {type:mime});
                }
        
                const file = await openai.files.create({
                    file: dataURLtoFile(image, "image.png"),
                    purpose: "vision",
                });

                return file;
            }
            console.log("Uploading files...");

            [file1, file2] = await Promise.all([
                getFile(image1),
                getFile(image2)
            ]);
            console.log("Done uploading files");

            let criteria = specific
                ? `5. Give two different guesses of the purpose using different personas and past annotation history. The purposes should have different themes and relate to the context.
6. For each guess, give two levels of detail: specific and broad. When describing with specific, describe the purpose so it is specific to the words of the annotated text. When describing with broad, use umbrella terms without using the annotated text.`
                : `5. Give four different guesses of the purpose using different personas and past annotation history. The purposes should have different themes and relate to the context.`;


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
            
            const thread = await openai.beta.threads.create({
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
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
2. Guess the purpose of the annotation based on the context.
3. Look at past annotation history in your knowledge base.
4. Summarize your past findings and relate them to the annotation.
${criteria}`
                            },
                            {
                                type: "image_file",
                                image_file: {
                                    file_id: file1.id,
                                }
                            },
                            {
                                type: "image_file",
                                image_file: {
                                    file_id: file2.id,
                                }
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
                                type: "text",
                                text: "Let's work this out in a step by step way to be sure we have described the annotation in the context of past history and determined thematically different purposes that matches the user's context (The user is marking an English test)."
                            }
                        ],
                    }
                ],
            });

            const purposeAssistant = await openai.beta.assistants.retrieve(assistantPurposeID);
            const vectorStoreID = purposeAssistant.tool_resources.file_search.vector_store_ids[0];
            
            if (vectorStoreID) {
                let vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreID);
                console.log("Checking vector store status...", vectorStore.status);
            
                while (vectorStore.status !== "completed") {
                    await new Promise(r => setTimeout(r, 1000));
                    vectorStore = await openai.beta.vectorStores.retrieve(vectorStoreID);
                    console.log("Checking vector store status...", vectorStore.status);
                }
            } else {
                console.log("Vector store is not available");
            }
            console.log("Running GPT-4 Vision...");
            
            // const r = await openai.beta.threads.runs.createAndPoll(thread.id, {
            //     assistant_id: assistantPurposeID,
            //     tool_choice: { type: "file_search" },
            //     // response_format: { type: "json_object" }
            // });

            let run = await openai.beta.threads.runs.createAndPoll(thread.id, 
                {
                    assistant_id: assistantPurposeID,
                    tool_choice: { type: "file_search" },
                    // response_format: { type: "json_object" }
                }, 
                { pollIntervalMs: 500 }
            );

    //         const m = await openai.beta.threads.messages.list(thread.id, {
    //             run_id: run.id,
    //         });

    //         console.log(m);

    //         await openai.beta.threads.messages.create(thread.id, {
    //             role: "user",
    //             content: `Parse your response as a JSON object in this format:
    // {
    //     "annotationDescription": "<annotation description>",
    //     "pastAnnotationHistory": "<annotation history>",
    //     "purpose": [
    //         {
    //             "persona": "<persona 1>",
    //             "purpose": "<purpose 1>",
    //             "purposeTitle": "<purpose_title 1>"
    //         },
    //         {
    //             "persona": "<persona 2>",
    //             "purpose": "<purpose 2>",
    //             "purposeTitle": "<purpose_title 2>"
    //         },
    //         {
    //             "persona": "<persona 3>",
    //             "purpose": "<purpose 3>",
    //             "purposeTitle": "<purpose_title 3>"
    //         },
    //         {
    //             "persona": "<persona 4>",
    //             "purpose": "<purpose 4>",
    //             "purposeTitle": "<purpose_title 4>"
    //         },
    //     ]
    // }

    // <annotation description>: is a detailed description of the annotation
    // <annotation history> is a detailed annotation history related to the annotation.
    // <purpose>: is a concise description of the annotation purpose using the <annotation description> and <annotation history> as context.
    // <purpose_title>: is a short title for <purpose> without mentioning the persona.`
    //         });

    //         run = await openai.beta.threads.runs.createAndPoll(thread.id, {
    //             assistant_id: assistantPurposeID,
    //         });
            
            const messages = await openai.beta.threads.messages.list(thread.id, {
                run_id: run.id,
            }, { maxRetries: 3 });
        
            const message = messages.data.pop();
            
            console.log(message);

            if (!message) {
                openai.beta.threads.runs.retrieve(thread.id, run.id)
                .then((run) => {
                    console.log(run);
                });
            }
        
            if (message.content[0].type === "text") {
                const { text } = message.content[0];
                let regex = /\{(\s|.)*\}/g;
        
                let match = (text.value).match(regex);
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

                try {
                    openai.files.del(file1.id)
                    .catch((error) => {
                        console.error(error.error.message, "in files");
                    });
                    
                    openai.files.del(file2.id)
                    .catch((error) => {
                        console.error(error.error.message, "in files");
                    });
                } catch (error) {
                    console.error(error);
                }
                purposeQueue--;
                resolve({ rawText: text.value, result: checkResult });
            } else {
                throw new Error("No text response found.");
            }
        } catch (error) {
            console.error(error);
            
            try {
                if (file1.id) {
                    openai.files.del(file1.id)
                    .catch((error) => {
                        console.error(error.error.message, "in files");
                    });
                }

                if (file2.id) {
                    openai.files.del(file2.id)
                    .catch((error) => {
                        console.error(error.error.message, "in files");
                    });
                }
            } catch (error) {
                console.error(error);
            }
            await new Promise(r => setTimeout(r, 1000));
            purposeQueue--;
            // return await makeInference(image1, image2, type, annotatedText);
            resolve(await makeInference(image1, image2, type, annotatedText, specific));
        }
    });
}