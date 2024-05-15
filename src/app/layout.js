import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "AnnotateGPT",
    description: "Implicit Pen Annotation Assisted by Large Language Models",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body suppressHydrationWarning={true} className={inter.className}><div id="root">{children}</div></body>
        </html>
    );
}
