import OpenAI from "openai";

const openai = new OpenAI({apiKey: process.env.REACT_APP_OPEN_AI_KEY, dangerouslyAllowBrowser: true});
const test = process.env.REACT_APP_TEST_IMG;
const cropTest = process.env.REACT_APP_TEST_IMG_CROP;

async function main(image1, image2) {
    console.log("test");

    const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        max_tokens: 1028,
        messages: [
            {
                role: "system",
                content: [
                    {
                        type: "text",
                        text: "You are an expert in determining the purpose of annotations. You will be shown images of annotations from a document a user has personallly annotated. You will answer questions about the images to your best of your ability."
                    }
                ],
            },
            {
                role: "user",
                content: [
                    { type: "text", text: "The first image is a document with all the annotations. The second image is a cropped version of the first image. What is the purpose of the annotations in the second image? Let's work this out in a step by step way to be sure we have the right answer." },
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
        ],
    });
    console.log(response.choices);
    console.log(response.choices[0].message.content);
}
// main(test, cropTest).catch(console.error);