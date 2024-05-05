/* eslint-disable no-unreachable */
/* eslint-disable no-unused-vars */
import OpenAI from "openai";
import * as data from "./TestData";
import * as img from "./TestImg";

const openai = new OpenAI({apiKey: process.env.REACT_APP_OPEN_AI_KEY, dangerouslyAllowBrowser: true});
const test = process.env.REACT_APP_TEST_IMG;
const cropTest = process.env.REACT_APP_TEST_IMG_CROP;

const noNoteTest = process.env.REACT_APP_NO_NOTE_TEST;
const noNoteTestCrop = process.env.REACT_APP_NO_NOTE_TEST_CROP;
const assistantID = process.env.REACT_APP_ASSISTANT_ID;

// makeInference(noNoteTest, noNoteTestCrop, "circled", "TOUCH FREE CAMERA MENTAL COMMANDS AND HAND GESTURES").catch(console.error);
// makeInference(test, cropTest, "circled", "TOUCH FREE CAMERA MENTAL COMMANDS AND HAND GESTURES").catch(console.error);
// makeInference(img.img1, img.img2, "underlined", "utilizes").catch(console.error);

// Reading every page and find sentences that could be annotated with:

// "Enhanced Appeal": "A peer reviewer might have indicated the title as 'Better' because it effectively captures interest and reflects the cutting-edge nature of the research, enhancing the document's appeal."

// Here is a step-by-step list for annotating a document:

// 1. Read every page
// 2. Find all sentences that could be annotated
// 3. Make a list of sentences for each analysis (e.g. 1. """ <put a sentence here> """ 2. """ <put sentence here> """ etc.)
// 4. Continue to the next section to identify more sentences
// 5. You must make one analysis for each section:
// (e.g. <Make retrieval for Section 1>
// <Put Section 1 title>
// <List of sentences for Section 1>
// <Make retrieval for Section 2>
// <Put Section 2 title>
// <List of sentences for Section 2>
// etc. )

// Lets work in a step by step way to be sure we have all the sentences

// findAnnotations(`"Engage Technology Audience": "The aim is to capture the attention of an audience interested in innovative technologies, suggesting a more dynamic or precise title to better engage readers."`)
// findAnnotations(`"Clarify Academic Focus": "The suggestion aims to refine the title to more effectively convey the primary focus or uniqueness of the work, potentially increasing its clarity and academic appeal."`)
// findAnnotations(`The word 'utilizes' is underlined, and there is a handwritten note beside it suggesting to 'replace with 'use''. "Simplification of Vocabulary": "The editor has underlined the word to suggest a simpler or more direct vocabulary in the manuscript, which may help in making the text more accessible and easier to understand."`)
// findAnnotations(`"Literature Review"`)

export async function findAnnotations(purpose, callback, endCallback) {
    console.log(purpose);

    for (let token of data.test9) {
        // console.log(token);
        await new Promise(r => setTimeout(r, 10));

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

        await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
`Read every page and find sentences that could be annotated with:

"Clarify Academic Focus": "The suggestion aims to refine the title to more effectively convey the primary focus or uniqueness of the work, potentially increasing its clarity and academic appeal."

Here is a step-by-step list for annotating a document:

1. Retrieve the first section
2. Find all sentences that could be annotated. Directly quote senteces from the document without rephrasing.
3. Make a list of sentences for the section using three double quotes for sentences and three curly braces for the explanation. For example:
   """ <put sentence here> """
   {{{ <put explanation here> }}}
   """ <put sentence here> """
   {{{ <put explanation here> }}}
   ...
4 Continue to the next section and repeat steps 1-4 for the next section until the end

Lets work in a step by step way to be sure we have all the sentences`
        });

        await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
`Here are some additional sentences that embody the core principle of "Clarify Academic Focus" by aiming to refine content to more effectively convey the primary focus of the work:
1. """The focus of this thesis is on introducing another way to use a camera, making it less obstructive and interruptive to create a more immersive and fluent experience."""
- {{{ This sentence succeeds in specifying the academic focus but might benefit from an expanded description of how the proposed method makes camera use less obstructive. }}}
2. """The solution presented is to remove the display entirely to hide any distractions and mount the camera where the user does not need to reach for it."""
- {{{ This sentence outlines a key part of the thesis' innovation but could be framed better to highlight how it contributes uniquely to advancing user experience in camera usage. }}}
I will continue reading for more sentences that align with the request. Let's scroll further.`
        });

        await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
`Continuing, I found another set of sentences that align with the purpose of "Clarify Academic Focus":
1. """Achieving the most immersive experience would require the user not to look at any display."""
- {{{ While this asserts an immersive experience, a clarification such as, “Aiming for an immersive hands-free interface, the device removes all visual displays requiring user interaction” might centralize the focus on a hands-free approach more explicitly. }}}
2. """Combining eye tracking with image processing algorithms can provide more context and detail making different camera modes possible without needing a display or touching any devices."""
- {{{ This sentence could be modified for clarity on why the integration of eye-tracking enhances the functionality and uniqueness of camera modes, perhaps by specifying what additional data or user feedback is enabled by eye tracking. }}}
3. """Brain-computer interfaces acquire the wearer’s brain signals and analyze them to execute the desired action."""
- {{{ It might be beneficial to specify what types of actions or commands are typical or particularly innovative in the context of this research, for clarity and focus. }}}
4. """Wireless earbuds are used to hear any feedback from the camera with minimal time to set up and no wires in the way of the user."""
- {{{ Clarification could be given on how this wireless feedback contributes to the focus on creating a more user-centric and intuitive experience. }}}
I will continue reading the document to find more pertinent sentences. Let's move to the next sections.`
        });

        await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
`The following sentences from the latest section could also be annotated with the purpose of "Clarify Academic Focus" as they may benefit from refinements to better focus on or convey the academic novelty:
1. """Photo taking, object detection, and translation are the implemented modes."""
- {{{ This sentence briefly lists the modes but could be expanded to clarify how each mode supports the overall academic or practical purpose of the technology. }}}
2. """These modes present a solution to cover all the use cases for a camera by executing a hand gesture associated with the desired mode."""
- {{{ This sentence could be revised to specify how each mode individually contributes to covering all use cases of a camera, emphasizing the innovative aspect of using hand gestures. }}}
3. """A custom cropping algorithm to reove noise from the image."""
- {{{ This sentence describes a process but could benefit from a clearer explanation of why focusing on the fixation point is innovative or beneficial for reducing visual noise in images. }}}
I will proceed to analyze the final parts of the document for any additional sentences that fit the purpose. Let's scroll further.`
        });

        await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
`In the conclusion section, several sentences that could benefit from clarification to enhance academic focus include:
1. """This work presents solutions to create a fluent experience when using a camera."""
- {{{ Detailing the proposed solutions' innovative advancements or technical mechanisms might better underline the academic value of the work. }}}
2. """It explores combining a brain-computer interface and eye-tracking glasses to create a touchless camera and take pictures with thoughts."""
- {{{ An elaboration on how the integration of these technologies results in a seamless user experience could provide clearer academic insight into the study's novelty. }}}
3. """Overall the hardware used replaces touch interactions with touch-less ones allowing the user to be more attentive to the present moment."""
- {{{ A more detailed rationale or discussion on how touchless interactions enhance user attentiveness could finalize the academic focus more effectively. }}}`
        });

        await openai.beta.threads.messages.create(thread.id, { role: "user", content: 
`Read every page and find sentences that could be annotated with:

${purpose}

Here is a step-by-step list for annotating a document:

1. Retrieve the first section
2. Find all sentences that could be annotated. Directly quote senteces from the document without rephrasing.
3. Make a list of sentences for the section using three double quotes for sentences and three curly braces for the explanation. For example:
   """ <put sentence here> """
   {{{ <put explanation here> }}}
   """ <put sentence here> """
   {{{ <put explanation here> }}}
   ...
4 Continue to the next section and repeat steps 1-4 for the next section until all sections are covered`
        });

        await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
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

        let executeRun = (checkFinish) => {
            let newTextDeltaArray = [];
            totalRuns++;

            const run = openai.beta.threads.runs.stream(thread.id, {
                assistant_id: "asst_AfodGi1mAYA91iYKcsY9Y97v",
                tool_choice: { type: "file_search" }
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

                if (checkFinish || totalRuns >= 5) {
                    if (newTextDeltaArray.join("").toLowerCase().includes("yes") || !newTextDeltaArray.join("").toLowerCase().includes(`"""`) || totalRuns >= 5) {
                        console.log("Stream ended");
                        console.log(textDeltaArray);

                        if (endCallback instanceof Function)
                            endCallback();
                        return;
                    }
                }

                await openai.beta.threads.messages.create(thread.id, { role: "assistant", content: 
                    `Is there a next section? Respond only with "yes" if you are done. Otherwise, annotate the next sections. Do not repeat any sentences.`
                });

                executeRun(true);
            });
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
    console.log(image1, image2);
    console.log(type, annotatedText);

    return new Promise(
        resolve => {
            setTimeout(() => {
                console.log("Resolving promise...");

                resolve(
                    JSON.parse(`{
                        "annotationDescription": "The user has circled the title of a thesis or document that reads 'TOUCH FREE CAMERA MENTAL COMMANDS AND HAND GESTURES' BY BENEDICT LEUNG. Additionally, there is a notation that reads 'Better title' suggesting a critique or a suggested improvement on the given title.",
                        "purpose": [
                            {
                                "persona": "Thesis Supervisor",
                                "purpose": "The annotation indicates a supervisor's recommendation to revise or improve the thesis title to better reflect the content or appeal more effectively to the target audience. It suggests a need for a tighter, perhaps more academic or marketable title in line with the conventions or expectations of their field.",
                                "purposeTitle": "Title Improvement Suggestion"
                            },
                            {
                                "persona": "Peer Reviewer",
                                "purpose": "This marking from a peer reviewer suggests that the current title may not be effectively capturing the essence of the work or it could be more precise. It implies that the title should be scrutinized and potentially modified to better convey the unique aspects of the research presented.",
                                "purposeTitle": "Title Clarity Enhancement"
                            },
                            {
                                "persona": "Future Researcher",
                                "purpose": "The annotation by a fellow researcher could be aiming to flag this title as a significant reference for future research. They might be suggesting an alternative title that could possibly make the work more discoverable in academic searches or more straightforward for future citations.",
                                "purposeTitle": "Optimization for Future Referencing"
                            },
                            {
                                "persona": "Student Critique",
                                "purpose": "A student could have annotated this during a peer-to-peer review session, indicating that the title might be improved for better engagement or clarity. This reflects a learning angle, where suggestions are made to help enhance academic presentation skills.",
                                "purposeTitle": "Peer-to-Peer Academic Enhancement"
                            }
                        ]
                    }`)
                );
            }, 1000);
        } 
    );

    // eslint-disable-next-line no-unreachable
    let messages = [
        {
            role: "system",
            content: [
                {
                    type: "text",
                    text: "You are an expert in determining the purpose of annotations. You will be shown two images of annotations from a document a user has personally annotated. The first image is a document with all the annotations. The second image is a cropped version of the first image. First describe the annotation in the second image, then determine the purpose of the annotation in detail. Do not give vague answers, for example, the user is interested or emphasizing the text. Give four different guesses of what it could be."
                }
            ],
        },
        {
            role: "user",
            content: [
                { type: "text", text: `A user has ${type}: "${annotatedText}".

Parse your response as a JSON object in this format: 
{
    "annotationDescription": "<annotation description>",
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
Where:

<annotation description>: is a detailed description of the annotation in the second image
<purpose>: is a detailed description of the annotation purpose using the <annotation description> as context.
<purpose_title>: is a short title for <purpose> without mentioning the persona.

Let's work this out in a step by step way to be sure we have the right answer.` },
                {
                    type: "image_url",
                    image_url: {
                        "url": image1,
                    },
                },
                {
                    type: "image_url",
                    image_url: {
                        "url": image2
                    },
                }
            ],
        },
    ];

    let validResponse = false;
    let response;

    while (!validResponse) {
        console.log("Running GPT-4 Vision...");

        try {
            response = await openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: messages,
                response_format: {type: "json_object"},
                // tools: tools,
                // tool_choice: {"type": "function", "function": {"name": "display_purposes"}},
            });
            validResponse = true;

            console.log(response);
            console.log(response.choices[0].message.content);
            return JSON.parse(response.choices[0].message.content);
        } catch (error) {
            console.error(error);
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    // messages.push({
    //     role: "assistant",
    //     content: [
    //         {
    //             type: "text",
    //             text: response.choices[0].message.content
    //         }
    //     ]
    // });

    // messages.push({
    //     role: "user",
    //     content: [
    //         {
    //             type: "text",
    //             text: ""
    //         }
    //     ]
    // });
    
    // validResponse = false;
    // console.log(messages);

    // while (!validResponse) {
    //     console.log("Parsing response...");
    //     try {
    //         const response = await openai.chat.completions.create({
    //             model: "gpt-4-turbo",
    //             max_tokens: 1028,
    //             messages: messages,
    //             // response_format: {type: "json_object"}
    //         });
    //         console.log(response.choices[0].message.content);

    //         let regex = /\[(\s|.)*\]/g;
    //         let match = (response.choices[0].message.content).match(regex);

    //         let parsedResponse = JSON.parse(match[0]);

    //         // if (parsedResponse.purpose === undefined) {
    //         //     throw new Error("Invalid response format");
    //         // }
    //         console.log(parsedResponse);
    //         validResponse = true;
    //         return parsedResponse;
    //     } catch (error) {
    //         console.error(error);
    //     }
    //     await new Promise(r => setTimeout(r, 1000));
    // }
}