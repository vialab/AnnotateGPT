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
// makeInference(img.img5, img.img6, "annotated (not circled, underlined or highlighted)", "(i.e.").catch(console.error);

// "Enhanced Appeal": "A peer reviewer might have indicated the title as 'Better' because it effectively captures interest and reflects the cutting-edge nature of the research, enhancing the document's appeal."


// findAnnotations(`"Engage Technology Audience": "The aim is to capture the attention of an audience interested in innovative technologies, suggesting a more dynamic or precise title to better engage readers."`)
// findAnnotations(`"Clarify Academic Focus": "The suggestion aims to refine the title to more effectively convey the primary focus or uniqueness of the work, potentially increasing its clarity and academic appeal."`)
// findAnnotations(`The word 'utilizes' is underlined, and there is a handwritten note beside it suggesting to 'replace with 'use''. "Simplification of Vocabulary": "The editor has underlined the word to suggest a simpler or more direct vocabulary in the manuscript, which may help in making the text more accessible and easier to understand."`)
// findAnnotations(`"Literature Review"`)

export async function findAnnotations(purpose, callback, endCallback) {
    console.log(purpose);
    // await new Promise(r => setTimeout(r, 3000));

    for (let token of data.test14) {
        // console.log(token);
        await new Promise(r => setTimeout(r, 30));

        if (callback instanceof Function) {
            callback(token);
        }
    }
    if (endCallback instanceof Function)
        endCallback();

    return;

    try {
        const thread = await openai.beta.threads.create();
        let textDeltaArray = [];

//         await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
// `Read every page and find sentences that could be annotated with:

// "Clarify Academic Focus": "The suggestion aims to refine the title to more effectively convey the primary focus or uniqueness of the work, potentially increasing its clarity and academic appeal."

// Here is a step-by-step list for annotating a document:

// 1. Describe what to look for in the document
// 2. Retrieve the first section
// 3. Find all sentences that could be annotated. Directly quote sentences from the document without rephrasing.
// 4. Make a list of sentences for the section using three double quotes for sentences and three curly braces for the explanation. For example:
//    """ <put sentence here> """
//    {{{ <put explanation here> }}}
//    """ <put sentence here> """
//    {{{ <put explanation here> }}}
//    ...
// 5. Continue to the next section and repeat steps 1-4 for the next section until the end

// Lets work in a step by step way to be sure we have all the sentences`
//         });

//         await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
// `Here are some additional sentences that embody the core principle of "Clarify Academic Focus" by aiming to refine content to more effectively convey the primary focus of the work:
// 1. """The focus of this thesis is on introducing another way to use a camera, making it less obstructive and interruptive to create a more immersive and fluent experience."""
// - {{{ This sentence succeeds in specifying the academic focus but might benefit from an expanded description of how the proposed method makes camera use less obstructive. }}}
// 2. """The solution presented is to remove the display entirely to hide any distractions and mount the camera where the user does not need to reach for it."""
// - {{{ This sentence outlines a key part of the thesis' innovation but could be framed better to highlight how it contributes uniquely to advancing user experience in camera usage. }}}
// I will continue reading for more sentences that align with the request. Let's scroll further.`
//         });

//         await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
// `Continuing, I found another set of sentences that align with the purpose of "Clarify Academic Focus":
// 1. """Achieving the most immersive experience would require the user not to look at any display."""
// - {{{ While this asserts an immersive experience, a clarification such as, “Aiming for an immersive hands-free interface, the device removes all visual displays requiring user interaction” might centralize the focus on a hands-free approach more explicitly. }}}
// 2. """Combining eye tracking with image processing algorithms can provide more context and detail making different camera modes possible without needing a display or touching any devices."""
// - {{{ This sentence could be modified for clarity on why the integration of eye-tracking enhances the functionality and uniqueness of camera modes, perhaps by specifying what additional data or user feedback is enabled by eye tracking. }}}
// 3. """Brain-computer interfaces acquire the wearer’s brain signals and analyze them to execute the desired action."""
// - {{{ It might be beneficial to specify what types of actions or commands are typical or particularly innovative in the context of this research, for clarity and focus. }}}
// 4. """Wireless earbuds are used to hear any feedback from the camera with minimal time to set up and no wires in the way of the user."""
// - {{{ Clarification could be given on how this wireless feedback contributes to the focus on creating a more user-centric and intuitive experience. }}}
// I will continue reading the document to find more pertinent sentences. Let's move to the next sections.`
//         });

//         await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
// `The following sentences from the latest section could also be annotated with the purpose of "Clarify Academic Focus" as they may benefit from refinements to better focus on or convey the academic novelty:
// 1. """Photo taking, object detection, and translation are the implemented modes."""
// - {{{ This sentence briefly lists the modes but could be expanded to clarify how each mode supports the overall academic or practical purpose of the technology. }}}
// 2. """These modes present a solution to cover all the use cases for a camera by executing a hand gesture associated with the desired mode."""
// - {{{ This sentence could be revised to specify how each mode individually contributes to covering all use cases of a camera, emphasizing the innovative aspect of using hand gestures. }}}
// 3. """A custom cropping algorithm to reove noise from the image."""
// - {{{ This sentence describes a process but could benefit from a clearer explanation of why focusing on the fixation point is innovative or beneficial for reducing visual noise in images. }}}
// I will proceed to analyze the final parts of the document for any additional sentences that fit the purpose. Let's scroll further.`
//         });

//         await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
// `In the conclusion section, several sentences that could benefit from clarification to enhance academic focus include:
// 1. """This work presents solutions to create a fluent experience when using a camera."""
// - {{{ Detailing the proposed solutions' innovative advancements or technical mechanisms might better underline the academic value of the work. }}}
// 2. """It explores combining a brain-computer interface and eye-tracking glasses to create a touchless camera and take pictures with thoughts."""
// - {{{ An elaboration on how the integration of these technologies results in a seamless user experience could provide clearer academic insight into the study's novelty. }}}
// 3. """Overall the hardware used replaces touch interactions with touch-less ones allowing the user to be more attentive to the present moment."""
// - {{{ A more detailed rationale or discussion on how touchless interactions enhance user attentiveness could finalize the academic focus more effectively. }}}`
//         });

//         await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
// `Read every page and find sentences that could be annotated with:

// "Engage Technology Audience": "The aim is to capture the attention of an audience interested in innovative technologies, suggesting a more dynamic or precise title to better engage readers."

// Here is a step-by-step list for annotating a document:

// 1. Describe what to look for in the document
// 2. Retrieve the first section
// 3. Find all sentences that could be annotated. Directly quote sentences from the document without rephrasing.
// 4. Make a list of sentences for the section using three double quotes for sentences and three curly braces for the explanation. For example:
//    """ <put sentence here> """
//    {{{ <put explanation here> }}}
//    """ <put sentence here> """
//    {{{ <put explanation here> }}}
//    ...
// 5. Continue to the next section and repeat steps 1-4 for the next section until the end

// Lets work in a step by step way to be sure we have all the sentences`
//         });

//         await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
// `Based on the provided document and the purpose of annotation which is to "Engage Technology Audience," I will now begin analyzing the document to identify sentences that could be annotated to better engage readers interested in innovative technologies.`
//         });

//         await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
// `The abstract of the document contains sentences that can be annotated for engaging a technology audience:
// 1. """Technology has altered the immersion of our lives for the worse.""" 
// - {{{ Highlight the impact of technology and suggest a title that emphasizes the dual nature of technological advancement. }}}
// 2. """Using touch-free technology can lessen the divide between technology and reality and bring us closer to the immersion we once had before."""
// - {{{ Emphasize the innovative aspect of touch-free technology to attract readers interested in seamless integrations of technology with daily life }}}
// I will now continue to the next section to identify more sentences.`
//         });

//         await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
// `In the Introduction section, the following sentences can be further annotated to engage a technology audience:
// 1. """The focus of this thesis is on introducing another way to use a camera, making it less obstructive and interruptive to create a more immersive and fluent experience."""
// - {{{ Highlight the innovative approach to camera use for an engaged technology audience, suggesting a catchier and more engaging title reflecting progressive camera utilization techniques. }}}
// 2. """Mounting the camera alone does not solve the user reaching for the device."""
// - {{{ Underline the need for innovative solutions beyond traditional methods, suggesting this as a pivotal point in engaging tech enthusiasts in the document. }}}
// 3. """Touch-less gestures were used to interact with the camera, minimizing the user touching the device."""
// - {{{ Emphasize the cutting-edge touch-less interaction technology to capture the attention of tech-oriented readers, suggesting a headline that highlights this revolutionary approach. }}}
// I will continue to the next section to identify more relevant sentences.`
//         });

//         await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
// `In the Body of the document, the following sentences can be annotated to engage a technology audience:
// 1. """Different camera modes are implemented to fit the user’s needs or requirements."""
// - {{{ Highlight the customization and adaptability of the camera modes to engage tech enthusiasts interested in modular technology. }}}
// 2. """One possible solution is eye-tracking to determine where the user is interested in the scene."""
// - {{{ Emphasize the innovative solution of eye-tracking to captivate an audience that values advanced interaction technologies, suggesting a title that resonates with these cutting-edge implementations. }}}
// 3. """Combining eye tracking with image processing algorithms can provide more context and detail making different camera modes possible without needing a display or touching any devices."""
// - {{{ Underline the combined use of eye-tracking and image processing to attract readers interested in seamless and intuitive tech solutions, suggesting a more dynamic title. }}}
// 4. """Audio feedback can have many forms such as audio cues (sound effects) and speech."""
// - {{{ Focus on the versatile use of audio feedback to attract readers interested in innovative audio interaction technologies. }}}
// I will now continue to the next sections of the document.`
//         });

//         await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
// `In the Implementation section, the following sentences are relevant to the annotation goal of engaging a technology audience:
// 1. """Training is required for the brain-computer interface to recognize user-specific brain activity patterns to create mental commands."""
// - {{{ Highlight the intersection of neuroscience and technology through brain-computer interfaces to captivate an audience interested in cutting-edge cerebral technologies. }}}
// 2. """Photo taking, object detection, and translation are the implemented modes."""
// - {{{ Emphasize the multifunctionality of the device to engage a tech-savvy audience, suggesting a title that highlights its various capabilities. }}}
// 3. """Translation has been used for many purposes and it could help with academics or help with navigating a foreign country."""
// - {{{ Focus on the practical applications of the translation feature to attract readers interested in real-world tech solutions, possibly suggesting a more targeted title discussing technology in daily life and travel. }}}
// 4. """Visual search is designed to search for information on the Internet using images."""
// - {{{ Underline the innovative feature of visual search to engage an audience interested in search technologies and image processing, suggesting a more striking title that captures the technology’s essence. }}}
// I will continue to search for more sentences.`
//         });

//         await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
// `In the Conclusion section, several sentences can be annotated for engaging a technology audience:
// 1. """This section will talk about the work accomplished and its limitations."""
// - {{{ Highlight key innovative points and breakthroughs to captivate readers interested in the development and challenges in technology. }}}
// 2. """Touch-free gestures with a head-mounted device can help users focus on the present moment rather than looking at a display and maneuvering the device."""
// - {{{ Emphasize the advanced touch-free technology to engage audiences looking for futuristic interaction methods, suggesting an engaging title. }}}
// 3. """All hardware limitations can be solved in the future. A BCI integrated with eye-tracking glasses can solve both devices hindering each other’s performance."""
// - {{{ Focus on the potential of combining these technologies to intrigue readers about the future of integrative tech solutions. }}}
// 4. """Many optimizations can be made to the touch-less camera but are not implemented due to accessibility of the technology and time constraints."""
// - {{{ Discuss the potential improvements and current limitations to generate discussion among tech innovators and enthusiasts. }}}
// 5. """The potential of this work can be extended with different interactions such as voice recognition and haptic"""
// - {{{ Underline the multifunctional expansion possibilities to attract readers interested in versatile and adaptive technology. }}}
// 6. """There are ethical concerns about how this work allows users to take pictures without noticing potentially invading someone’s privacy."""
// - {{{ Engage readers in a critical ethical discussion about the implications of such technology, which could generate substantial interest and debate among a tech-conscious audience. }}}
// This concludes the comprehensive search for sentences within the document that could be annotated to engage a technology audience.`
//         });

        await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
`Read every page and find sentences that could be annotated with:

${purpose}

Here is a step-by-step list for annotating a document:

1. Describe what details in sentences to look for in the document. Be specific. Do not change the original purpose in any way.
2. Explain why you annnotated the sentence. Format the explanation as short as possible using 10 words or less. Make sure to include the purpose of the annotation in the explanation.
3. Make a list of sentences for the section using three asterisks for sentences and two curly braces for the explanation. For example:
   *** <sentence> ***
   {{ <explanation and suggestion> }}`
        });

        await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
`Lets work this out in a step by step way to be sure we have the right answer.`
        });

        // let run = await openai.beta.threads.runs.createAndPoll(
        //     thread.id,
        //     { 
        //         assistant_id: assistantID,
        //         max_completion_tokens: 4096
        //     }
        // );

        // if (run.status === 'completed') {
        //     const messages = await openai.beta.threads.messages.list(
        //         run.thread_id
        //     );

        //     console.log(messages);

        //     for (const message of messages.data.reverse()) {
        //         console.log(`${message.role} > ${message.content[0].text.value}`);
        //     }
        // } else {
        //     console.log(run.status);
        // }

        let totalRuns = 0;

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
        }
        console.log("Running GPT-4o...");
        return;

        let executeRun = (checkFinish) => {
            let newTextDeltaArray = [];
            totalRuns++;

            try {
                const run = openai.beta.threads.runs.stream(thread.id, {
                    assistant_id: assistantAnnotateID,
                    tool_choice: { type: "file_search" },
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
                    console.log(newTextDeltaArray.join(""));
                    console.log("Stream ended");
                    console.log(textDeltaArray);

                    if (endCallback instanceof Function)
                        endCallback(textDeltaArray);
                    return;
                    
                    console.log(newTextDeltaArray.join(""));
    
                    if (checkFinish || totalRuns >= 5) {
                        if (newTextDeltaArray.join("").toLowerCase().includes("yes") || !newTextDeltaArray.join("").toLowerCase().includes(`"""`) || totalRuns >= 5) {
                            console.log("Stream ended");
                            console.log(textDeltaArray);
    
                            if (endCallback instanceof Function)
                                endCallback(textDeltaArray);
                            return;
                        }
                    }
    
                    await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
                        `Are you done? Respond only with "yes" if you are done. Otherwise, annotate the next sections using the same format. Do not repeat any previously mentioned sentences.`
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

        // return new Promise((resolve, reject) => {
        //     setTimeout(() => {
        //         resolve(findAnnotations(purpose));
        //     }, 10000);
        // });
    }
}

export async function makeInference(image1, image2, type, annotatedText) {
    let file1, file2;
    console.log(image1, image2);
    console.log(type, annotatedText);
    
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
                                text: `A user has ${type}:\n"${annotatedText}"`
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
    <purpose>: is a description of the annotation purpose using the <annotation description> and <annotation history> as context. Talk in second first person (you, your, etc.) and use as few words as possible.
    <purpose_title>: is a short title for <purpose> without mentioning the persona.`
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

            let run = await openai.beta.threads.runs.createAndPoll(thread.id, {
                assistant_id: assistantPurposeID,
                tool_choice: { type: "file_search" },
                // response_format: { type: "json_object" }
            });

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
            });
        
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
            makeInference(image1, image2, type, annotatedText);
        }
    });
}