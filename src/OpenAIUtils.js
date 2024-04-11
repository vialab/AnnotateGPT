/* eslint-disable no-unused-vars */
import OpenAI from "openai";

const openai = new OpenAI({apiKey: process.env.REACT_APP_OPEN_AI_KEY, dangerouslyAllowBrowser: true});
const test = process.env.REACT_APP_TEST_IMG;
const cropTest = process.env.REACT_APP_TEST_IMG_CROP;

const noNoteTest = process.env.REACT_APP_NO_NOTE_TEST;
const noNoteTestCrop = process.env.REACT_APP_NO_NOTE_TEST_CROP;

// main(noNoteTest, noNoteTestCrop, "circled", "TOUCH FREE CAMERA MENTAL COMMANDS AND HAND GESTURES").catch(console.error);
// main(test, cropTest, "circled", "TOUCH FREE CAMERA MENTAL COMMANDS AND HAND GESTURES").catch(console.error);


async function main(image1, image2, type, annotatedText) {
    return new Promise(
        resolve => {
            setTimeout(resolve(
                JSON.parse(`[
                    {"Review Feedback": "The user could be a peer reviewer suggesting a more effective title for the thesis to better communicate the innovative aspects of the research in human-computer interaction."},
                    {"Personal Interest": "The annotation indicates the user's personal or professional interest in cutting-edge technologies such as touch-free control and mental commands, which could have applications in areas they are passionate about."},
                    {"Thesis Guidance": "A thesis supervisor or mentor might have made the annotation as guidance to refine the thesis title to encapsulate the core innovations discussed in the undergraduate thesis."},
                    {"Business Exploration": "The user, potentially an investor or entrepreneur, may be identifying innovative ideas for product or service development, with the additional note indicating marketing or product positioning considerations."}
                  ]`)
            ), 1000);
        } 
    );

    // eslint-disable-next-line no-unreachable
    let messages = [
        {
            role: "system",
            content: [
                {
                    type: "text",
                    text: "You are an expert in determining the purpose of annotations. You will be shown two images of annotations from a document a user has personally annotated. The first image is a document with all the annotations. The second image is a cropped version of the first image. Determine the purpose of the annotations in the second image in detail. Do not give vague answers, for example, the user is interested or emphasizing the text. Give four different guesses of what it could be using different personas."
                }
            ],
        },
        {
            role: "user",
            content: [
                { type: "text", text: `A user has ${type}: "${annotatedText}". Let's work this out in a step by step way to be sure we have the right answer.` },
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
                max_tokens: 1028,
                messages: messages,
                // tools: tools,
                // tool_choice: {"type": "function", "function": {"name": "display_purposes"}},
            });
            validResponse = true;

            console.log(response);
            console.log(response.choices[0].message.content);
        } catch (error) {
            console.error(error);
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    messages.push({
        role: "assistant",
        content: [
            {
                type: "text",
                text: response.choices[0].message.content
            }
        ]
    });

    messages.push({
        role: "user",
        content: [
            {
                type: "text",
                text: "Parse your response as an array where each item is in this format: {\"<purpose_title>\": \"<purpose>\"} where <purpose_title> is the annotation purpose in less than five words without the persona, and <purpose> is the description of the annotation purpose."
            }
        ]
    });
    
    validResponse = false;
    console.log(messages);

    while (!validResponse) {
        console.log("Parsing response...");
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4-vision-preview",
                max_tokens: 1028,
                messages: messages,
            });
            console.log(response.choices[0].message.content);

            let regex = /\[(\s|.)*\]/g;
            let match = (response.choices[0].message.content).match(regex);

            let parsedResponse = JSON.parse(match[0]);

            // if (parsedResponse.purpose === undefined) {
            //     throw new Error("Invalid response format");
            // }
            console.log(parsedResponse);
            validResponse = true;
        } catch (error) {
            console.error(error);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}