export default function About() {
    return (
        <div className="min-h-screen pt-28 pb-20 px-6">
            <div className="mx-auto max-w-4xl">
                <button
                    onClick={() => window.location.hash = '#index'}
                    className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                >
                    &larr; Back to Home
                </button>

                <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-6">About Atma Rekha</h1>
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                    <p className="text-lg text-zinc-600 dark:text-zinc-300 mb-6 font-medium">
                        Step into a world where nothing is as it seems. Every corner hides a secret, every choice carries weight, and every encounter can change a life.
                    </p>

                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        Follow journeys through mysterious lands, where hidden truths, powerful forces, and unexpected alliances shape the path ahead. This is a story of adventure, discovery, and bonds that refuse to break—crafted to grip you from the first page to the last.
                    </p>

                    <div className="bg-zinc-100 dark:bg-zinc-900 p-8 rounded-3xl my-10 border border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">Original Creation</h3>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                            Every part of this manga—characters, designs, outfits, expressions, personalities, scenes, and dialogue—is entirely my original creation. AI is used only as a tool to adjust poses.
                        </p>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            All story ideas, characters, and core content are mine. AI only helps execute the vision faster and more precisely.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 my-12">
                        <div className="bg-zinc-100 dark:bg-zinc-900 p-6 rounded-2xl">
                            <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-white">Our Mission</h3>
                            <p className="text-zinc-600 dark:text-zinc-400">
                                To provide a global stage for Indian artists and storytellers, bringing their unique perspectives and cultural narratives to manga readers everywhere.
                            </p>
                        </div>
                        <div className="bg-zinc-100 dark:bg-zinc-900 p-6 rounded-2xl">
                            <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-white">Our Vision</h3>
                            <p className="text-zinc-600 dark:text-zinc-400">
                                To build a thriving community where creators and fans connect, inspiring a new wave of creativity in the Indian comic industry.
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-10 mt-12">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">About Atma Rekha as an Indian Manga</h2>

                        <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                            Atma Rekha is an original Indian manga and mythical fantasy story, created independently in India with a strong foundation in Indian culture, traditions, mythology, spirituality, and imagination.
                        </p>

                        <p className="text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                            Atma Rekha brings the visual language and storytelling spirit of manga into an original Indian setting. Its world draws inspiration from Indian cultural ideas, mythology, traditional symbolism, spiritual concepts, chakras, ancient weapons, and the timeless contrast between powerful forces of good and evil—while telling its own fictional story and creating its own characters, world, and lore.
                        </p>

                        <p className="text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
                            The goal is to create a distinctly Indian manga experience that feels authentic to its cultural roots while remaining accessible to anyone who loves fantasy, action, mystery, adventure, and original storytelling.
                        </p>

                        <div className="bg-zinc-100 dark:bg-zinc-900 p-8 rounded-3xl mb-8 border border-zinc-200 dark:border-zinc-800">
                            <h3 className="text-xl font-bold mb-4 text-zinc-900 dark:text-white">An Original Indian Creation</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                                Atma Rekha is an independently created Indian manga project. The story, characters, designs, personalities, scenes, dialogue, world, and core creative direction are original creations of the project.
                            </p>
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                AI may be used as a supporting creative tool for limited tasks such as pose adjustment, but the creative vision, storytelling, and core content remain human-created and directed.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 mb-8">
                            <div className="bg-zinc-100 dark:bg-zinc-900 p-6 rounded-2xl">
                                <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-white">The Indian Identity</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    Atma Rekha is made in India and is inspired by the country's rich cultural heritage, mythology, traditions, symbolism, and storytelling. These influences are used as foundations for an original fictional world rather than as a retelling of existing stories.
                                </p>
                            </div>

                            <div className="bg-zinc-100 dark:bg-zinc-900 p-6 rounded-2xl">
                                <h3 className="text-xl font-bold mb-3 text-zinc-900 dark:text-white">The Vision</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    The vision is to create a memorable Indian manga and comic experience, give original Indian storytelling a place on the global stage, and show that stories rooted in Indian culture can be explored through a modern manga-inspired format.
                                </p>
                            </div>
                        </div>

                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            Atma Rekha is an independent Indian fantasy manga created for readers who enjoy original worlds, cultural influences, action, mystery, mythology, and adventure. This website is the official home of the project.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
