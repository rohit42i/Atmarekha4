
export default function ImageShowcase() {
    const images = [
        "https://images.unsplash.com/photo-1588497859490-85d1c17db96d?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        "https://images.unsplash.com/photo-1744412161702-dcfd3bea6845?q=80&w=688&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        // New images
        "https://images.unsplash.com/photo-1577735478233-f27f7fd3ec68?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        "https://images.unsplash.com/photo-1683995259187-54142c49338b?q=80&w=1331&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        "https://images.unsplash.com/photo-1760113671986-63ccb46ae202?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        "https://images.unsplash.com/photo-1763732397784-c5ff2651d40c?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    ];

    return (
        <section className="py-20 px-6 bg-white dark:bg-zinc-900 transition-colors duration-300">
            <div className="mx-auto max-w-7xl">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl font-bold mb-4 text-zinc-900 dark:text-white">Captured Moments</h2>
                    <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                        Glimpses into the world we are building.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[300px]">
                    {images.map((img, index) => {
                        // Layout Logic:
                        // Index 0: Span 2 cols (Row 1)
                        // Index 3: Span 2 cols (Row 2)
                        // This creates a varied grid helper
                        let spanClass = "";
                        if (index === 0) spanClass = "md:col-span-2";
                        if (index === 3) spanClass = "md:col-span-2";

                        return (
                            <div
                                key={index}
                                className={`group relative overflow-hidden rounded-2xl shadow-lg cursor-pointer ${spanClass}`}
                            >
                                <img
                                    src={img}
                                    alt={`Showcase ${index + 1}`}
                                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transition-colors" />
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
