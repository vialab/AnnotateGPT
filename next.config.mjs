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
            }
        });

        return config;
    },
};

export default nextConfig;