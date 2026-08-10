import { useState, useEffect } from 'react';
import axios from 'axios';
import AdminStories from './AdminStories';
import AdminChapters from './AdminChapters';
import AdminReviews from './AdminReviews';
import AdminAnnouncements from './AdminAnnouncements';
import AdminHeroImages from './AdminHeroImages';

export default function Dashboard() {
    const [view, setView] = useState('home');
    const [selectedStoryId, setSelectedStoryId] = useState(null);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

    // Handle hash-based routing for direct links
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash.startsWith('#admin-chapters/')) {
                const storyId = hash.split('/')[1];
                setSelectedStoryId(storyId);
                setView('chapters');
            } else if (hash === '#dashboard') {
                setView('home');
                setSelectedStoryId(null);
            }
        };

        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const renderContent = () => {
        if (view === 'chapters' && selectedStoryId) {
            return (
                <AdminChapters
                    apiBaseUrl={apiBaseUrl}
                    storyId={selectedStoryId}
                    onBack={() => {
                        window.location.hash = '#dashboard';
                        setView('stories'); // Go back to stories list usually
                    }}
                />
            );
        }

        if (view === 'stories') {
            return (
                <div>
                    <button onClick={() => setView('home')} className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                        &larr; Back to Dashboard
                    </button>
                    <AdminStories apiBaseUrl={apiBaseUrl} />
                </div>
            );
        }

        if (view === 'reviews') {
            return (
                <AdminReviews
                    apiBaseUrl={apiBaseUrl}
                    onBack={() => setView('home')}
                />
            );
        }

        if (view === 'announcements') {
            return (
                <AdminAnnouncements
                    apiBaseUrl={apiBaseUrl}
                    onBack={() => setView('home')}
                />
            );
        }

        if (view === 'hero-images') {
            return (
                <AdminHeroImages
                    apiBaseUrl={apiBaseUrl}
                    onBack={() => setView('home')}
                />
            );
        }

        if (view === 'password') {
            return (
                <div className="mx-auto max-w-md">
                    <button onClick={() => setView('home')} className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                        &larr; Back to Dashboard
                    </button>
                    <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                        <h2 className="mb-6 text-xl font-bold dark:text-white">Change Password</h2>
                        <ChangePasswordForm apiBaseUrl={apiBaseUrl} />
                    </div>
                </div>
            );
        }

        return (
            <>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Admin Dashboard</h1>
                <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                    Welcome to the AtmaRekha admin panel. Select an option below to manage content.
                </p>

                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <div
                        onClick={() => setView('stories')}
                        className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                        <h3 className="font-semibold text-zinc-900 dark:text-white">Manage Stories & Chapters</h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Add, edit, or delete stories and their chapters.</p>
                    </div>

                    <div
                        onClick={() => setView('reviews')}
                        className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                        <h3 className="font-semibold text-zinc-900 dark:text-white">Manage Reviews</h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Moderate reader reviews.</p>
                    </div>

                    <div
                        onClick={() => setView('announcements')}
                        className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                        <h3 className="font-semibold text-zinc-900 dark:text-white">Manage Latest Updates</h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Post and edit announcements.</p>
                    </div>

                    <div
                        onClick={() => setView('hero-images')}
                        className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                        <h3 className="font-semibold text-zinc-900 dark:text-white">Manage Hero Images</h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Add or remove home page slides.</p>
                    </div>

                    <div
                        onClick={() => setView('password')}
                        className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                        <h3 className="font-semibold text-zinc-900 dark:text-white">Security Settings</h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Change your admin password.</p>
                    </div>

                </div>
            </>
        );
    };

    return (
        <main className="min-h-screen px-6 pt-28 pb-20">
            <div className="mx-auto max-w-4xl">
                {renderContent()}
            </div>
        </main>
    );
}

function ChangePasswordForm({ apiBaseUrl }) {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState({ type: 'idle', message: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            return setStatus({ type: 'error', message: 'New passwords do not match' });
        }

        setStatus({ type: 'loading', message: 'Updating password...' });
        const email = localStorage.getItem('adminEmail');

        try {
            const res = await axios.post(`${apiBaseUrl}/admin/change-password`, {
                email,
                oldPassword,
                newPassword
            });

            if (res.data.success) {
                setStatus({ type: 'success', message: 'Password updated successfully' });
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to update password' });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Old Password</label>
                <input
                    type="password"
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                    required
                />
            </div>
            <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">New Password</label>
                <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                    required
                />
            </div>
            <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm New Password</label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                    required
                />
            </div>

            <button
                type="submit"
                disabled={status.type === 'loading'}
                className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
                {status.type === 'loading' ? 'Updating...' : 'Update Password'}
            </button>

            {status.message && (
                <div className={`mt-2 rounded-lg p-3 text-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    status.type === 'error' ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                        'bg-zinc-100 text-zinc-600'
                    }`}>
                    {status.message}
                </div>
            )}
        </form>
    );
}


