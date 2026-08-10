import { useState } from 'react';

export default function HelpCenter() {
    const [openIndex, setOpenIndex] = useState(null);

    const faqs = [
        {
            question: "How do I read stories?",
            answer: "Simply navigate to the Home page and click on any story card to start reading. You can also use the 'Start Reading' button in the menu."
        },
        {
            question: "Is Atma Rekha free?",
            answer: "Yes, currently all stories on Atma Rekha are free to read. We aim to promote Indian Manga culture accessible to everyone."
        },
        {
            question: "How can I submit my own story?",
            answer: "We are working on a creator portal! For now, you can contact us via email to discuss submissions."
        },
        {
            question: "I found a bug, how do I report it?",
            answer: "Please email our support team with details about the issue."
        }
    ];

    const toggleFaq = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div className="min-h-screen pt-28 pb-20 px-6">
            <div className="mx-auto max-w-4xl">
                <button
                    onClick={() => window.location.hash = '#index'}
                    className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                >
                    &larr; Back to Home
                </button>

                <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">Help Center</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mb-12 text-lg">
                    Frequently asked questions and support contact information.
                </p>

                <div className="grid gap-12 md:grid-cols-2">
                    {/* Contact Section */}
                    <div>
                        <div className="rounded-2xl bg-zinc-900 p-8 text-white shadow-xl dark:bg-zinc-800">
                            <h2 className="text-2xl font-bold mb-4">Contact Support</h2>
                            <p className="text-zinc-300 mb-8">
                                Can't find what you're looking for? Our team is here to help you with any questions or issues.
                            </p>

                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center dark:bg-zinc-700">
                                    <i className="fas fa-envelope text-blue-400"></i>
                                </div>
                                <div>
                                    <p className="text-xs text-zinc-400 uppercase font-semibold tracking-wider">Email Us</p>
                                    <a href="mailto:atmarekha4u@gmail.com" className="font-medium hover:text-blue-300 transition">
                                        atmarekha4u@gmail.com
                                    </a>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center dark:bg-zinc-700">
                                    <i className="fas fa-phone text-blue-400"></i>
                                </div>
                                <div>
                                    <p className="text-xs text-zinc-400 uppercase font-semibold tracking-wider">Call Us</p>
                                    <a href="tel:+917204137931" className="font-medium hover:text-blue-300 transition">
                                        +91 72041 37931
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FAQ Section */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Frequently Asked Questions</h2>

                        {faqs.map((faq, index) => (
                            <div key={index} className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                                <button
                                    onClick={() => toggleFaq(index)}
                                    className="flex w-full items-center justify-between p-4 text-left font-medium text-zinc-900 dark:text-white"
                                >
                                    <span>{faq.question}</span>
                                    <i className={`fas fa-chevron-down transition-transform ${openIndex === index ? 'rotate-180' : ''}`}></i>
                                </button>
                                <div
                                    className={`px-4 text-zinc-500 dark:text-zinc-400 transition-all duration-300 ease-in-out ${openIndex === index ? 'max-h-40 pb-4 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                                        }`}
                                >
                                    {faq.answer}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
