/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack(config) {
        config.module.rules.push({
            test: /\.svg$/i,
            issuer: /\.[jt]sx?$/,
            use: {
                loader: '@svgr/webpack',
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

        return config;
    },
    swcMinify: false,
};

export default nextConfig;