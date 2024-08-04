/* eslint-disable indent */
/* eslint-disable no-unreachable */
/* eslint-disable no-unused-vars */
import OpenAI from "openai";
import * as data from "./TestData";
import * as img from "./TestImg";

const openai = new OpenAI({apiKey: process.env.NEXT_PUBLIC_OPEN_AI_KEY, dangerouslyAllowBrowser: true});

const assistantAnnotateID = process.env.NEXT_PUBLIC_ASSISTANT_ANNOTATE_ID;
const assistantPurposeID = process.env.NEXT_PUBLIC_ASSISTANT_PURPOSE_ID;

// makeInference(noNoteTest, noNoteTestCrop, "circled", "TOUCH FREE CAMERA MENTAL COMMANDS AND HAND GESTURES").catch(console.error);
// makeInference(test, cropTest, "circled", "TOUCH FREE CAMERA MENTAL COMMANDS AND HAND GESTURES").catch(console.error);
// makeInference(img.img1, img.img2, "underlined", "utilizes").catch(console.error);
// makeInference(img.img7, img.img8, "circled", "8 ] utilizes").catch(console.error);
// makeInference(img.img5, img.img6, "annotated (not circled, underlined or highlighted)", "(i.e.").catch(console.error).then(console.log);

// "Enhanced Appeal": "A peer reviewer might have indicated the title as 'Better' because it effectively captures interest and reflects the cutting-edge nature of the research, enhancing the document's appeal."


// findAnnotations(`"Engage Technology Audience": "The aim is to capture the attention of an audience interested in innovative technologies, suggesting a more dynamic or precise title to better engage readers."`)
// findAnnotations(`"Clarify Academic Focus": "The suggestion aims to refine the title to more effectively convey the primary focus or uniqueness of the work, potentially increasing its clarity and academic appeal."`)
// findAnnotations(`The word 'utilizes' is underlined, and there is a handwritten note beside it suggesting to 'replace with 'use''. "Simplification of Vocabulary": "The editor has underlined the word to suggest a simpler or more direct vocabulary in the manuscript, which may help in making the text more accessible and easier to understand."`)
// findAnnotations(`"Literature Review"`)
// findAnnotations(`"Syntactic Errors: Look for misplaced modifiers, incorrect verb forms, or run-on sentences"`)

export async function findAnnotations(purpose, callback, endCallback) {
    console.log(purpose);
    
    if (!process.env.NEXT_PUBLIC_VERCEL_ENV) {
        let message = "";
        // await new Promise(r => setTimeout(r, 3000));

        for (let token of data.test19) {
            // console.log(token);
            // await new Promise(r => setTimeout(r, 0.1));
            message += token;

            if (callback instanceof Function) {
                callback(token);
            }
        }        
        await new Promise(r => setTimeout(r, 8000));

        if (endCallback instanceof Function)
            endCallback();

        console.log(message);
        return;
    }

    try {
        const thread = await openai.beta.threads.create();
        let textDeltaArray = [];

        await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
`You are an expert in English grading an English test with 8 questions. Read every page and find sentences that could be annotated with:

${purpose}

Here is a step-by-step list for annotating a document:

1. Describe what details in sentences to look for in the document. Be specific. Do not change the original purpose in any way.
2. Explain why you annnotated the sentence.
3. Suggest fixes for the sentence by describing the fix without giving the answer.
4. Combine the explanation and suggestion without quoting the sentence using less than 20 words.
5. Do not include any sentences that need no modification.
6. Make a list of sentences for each response using triple asterisks for sentences and double curly braces for the explanation and suggestion. For example:

## Response <number>

*** <sentence> ***
{{ <explanation and suggestion> }}
...
`
        });

        await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
            `Lets work this out in a step by step way to be sure we have the correctly mark all questions.`
        });

        let totalRuns = 0;
        let maxRuns = 8;

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
                // .on('textCreated', (text) => console.log('\nassistant > '))
                .on('textDelta', (textDelta, snapshot) => {
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
                        if (!newTextDeltaArray.join("").toLowerCase().includes(`{{`) || totalRuns >= maxRuns) {
                            console.log("Stream ended");
                            console.log(textDeltaArray);
    
                            if (endCallback instanceof Function)
                                endCallback(textDeltaArray);
                            return;
                        }
                    }
    
                    await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
                        `Have you finished marking all eight questions? Respond with "yes" if so, otherwise continue marking without mentioning previous sentences.`
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
        
        await new Promise(r => setTimeout(r, 1000));
        findAnnotations(purpose, callback, endCallback);
    }
}

export async function makeInference(image1, image2, type, annotatedText) {
    let file1, file2;
    console.log(image1, image2);
    console.log(type, annotatedText);
    
    if (!process.env.NEXT_PUBLIC_VERCEL_ENV) {
        return new Promise(
            resolve => {
                setTimeout(() => {
                    console.log("Resolving promise...");

                    resolve({
                        rawText: "Bla bla bla...",
                        result: JSON.parse(`{
                            "annotationDescription": "The user has circled '8 ] utilizes' in the document. The annotation involves the text being encased in a hand-drawn circle, emphasizing the phrase within the context of the surrounding text.",
                            "pastAnnotationHistory": "Previous annotations have included both simplification of terminology (replacing 'utilize' with 'use') and recommendations for improvement or refinements, such as suggesting a better title for a thesis to better align it with academic standards or market expectations【6:1†history.txt】.",
                            "purpose": [
                                {
                                    "persona": "Academic Researcher",
                                    "purpose": "The annotation might serve to highlight a reference or method being used in a scholarly context, implying interest in or critique of the source or methodology cited.",
                                    "purposeTitle": "Highlighting Scholarly Reference"
                                },
                                {
                                    "persona": "Student",
                                    "purpose": "The student might have circled this text to remind themselves to look up the reference later, or to make a note of a significant term or concept that will be on an exam.",
                                    "purposeTitle": "Noting Significant Reference"
                                },
                                {
                                    "persona": "Editor or Reviewer",
                                    "purpose": "The circle might signify that the term 'utilizes' is either misused or can be replaced with a simpler word, similar to previous annotations where complex terms were simplified.",
                                    "purposeTitle": "Indication of Simplification"
                                },
                                {
                                    "persona": "Curious Reader",
                                    "purpose": "The reader may have circled this to indicate confusion or a point of interest, possibly requiring further investigation or clarity in the terminology or citation mentioned.",
                                    "purposeTitle": "Identification of Confusing Content"
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
                    while(n--) {
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
            
            const thread = await openai.beta.threads.create({
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `A user has ${type}:\n"${annotatedText}. The user is marking an English test."`
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
                            }
                        ],
                    },
                    {
                        role: "user",
                        content: `Parse your response as a JSON object in this format:
{
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
<purpose>: is a description of the annotation purpose and annotation type using the <annotation description> and <annotation history> as context. Talk in second person (you, your, etc.) and use as few words as possible.
<purpose_title>: is a short title for <purpose> without mentioning the persona, be very specific.`
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Let's work this out in a step by step way to be sure we have describe the annotation with the context of past history."
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
        
            if (message.content[0].type === "text") {
                const { text } = message.content[0];
                let regex = /\{(\s|.)*\}/g;
        
                let match = (text.value).match(regex);
                console.log(JSON.parse(match[0]));

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
                resolve({ rawText: text.value, result: JSON.parse(match[0]) });
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
            // return await makeInference(image1, image2, type, annotatedText);
            resolve(await makeInference(image1, image2, type, annotatedText));
        }
    });
}