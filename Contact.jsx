import { useState } from 'react';

export default function Contact() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const isMobileDevice = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const { name, email, subject, message } = formData;
        const recipient = 'atmarekha4u@gmail.com';

        // Construct the email body
        const emailBody = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;

        if (isMobileDevice()) {
            // Mobile: use mailto which opens default email app (often Gmail on Android/iOS)
            window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
        } else {
            // Desktop: Try to open Gmail web interface
            // If they are logged in, this works great. 
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
            window.open(gmailUrl, '_blank');
        }
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

                <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">Contact Us</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mb-12 text-lg">
                    We'd love to hear from you. Reach out to us for any queries, support, or feedback.
                </p>

                <div className="grid gap-12 md:grid-cols-2">
                    {/* Contact Details */}
                    <div>
                        <div className="rounded-2xl bg-zinc-900 p-8 text-white shadow-xl dark:bg-zinc-800">
                            <h2 className="text-2xl font-bold mb-4">Get in Touch</h2>
                            <p className="text-zinc-300 mb-8">
                                Our team is ready to assist you.
                            </p>

                            <div className="flex items-center gap-4 mb-6">
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

                        {/* Additional useful info could go here */}
                        <div className="mt-8 p-6 rounded-xl bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
                            <h3 className="font-bold text-lg mb-2 text-zinc-900 dark:text-white">Business Inquiries</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                                For partnerships or press, please use the form or email us directly.
                            </p>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                        <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">Send a Message</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition"
                                    placeholder="Your name"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition"
                                    placeholder="your@email.com"
                                />
                            </div>

                            <div>
                                <label htmlFor="subject" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Subject
                                </label>
                                <input
                                    type="text"
                                    id="subject"
                                    name="subject"
                                    required
                                    value={formData.subject}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition"
                                    placeholder="What is this regarding?"
                                />
                            </div>

                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                    Message
                                </label>
                                <textarea
                                    id="message"
                                    name="message"
                                    required
                                    rows="4"
                                    value={formData.message}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 rounded-lg border border-zinc-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-700 dark:text-white transition resize-none"
                                    placeholder="Type your message here..."
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-zinc-900 text-white font-medium py-3 rounded-lg hover:bg-zinc-800 transition dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                            >
                                Send Message
                            </button>
                            <p className="text-xs text-center text-zinc-500 mt-4">
                                This will open your default email client to send the message.
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
