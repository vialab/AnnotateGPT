/** @type {import("next").NextConfig} */
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nextConfig = {
    webpack(config) {

        config.module.rules.push({
            test: /\.svg$/i,
            issuer: /\.[jt]sx?$/,
            use: {
                loader: "@svgr/webpack",
                options: {
                    svgoConfig: {
                        plugins: [
                            {
                                name: "prefixIds",
                                params: {
                                    prefixIds: false,
                                    prefixClassNames: false
                                }
                            }
                        ],
                    }
                }
            },
        });

        config.resolve.alias.canvas = false;

        config.resolve.alias["@workers"] = resolve(__dirname, "src/workers");

        return config;
    },
    // swcMinify: false,
};

export default nextConfig;