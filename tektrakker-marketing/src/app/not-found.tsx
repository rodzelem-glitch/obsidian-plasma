import Link from 'next/link'
import { LandingHeader } from './components/LandingHeader'
import { LandingFooter } from './components/LandingFooter'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <LandingHeader />
      <main className="flex-grow flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-5xl font-black mb-4 text-slate-800">404 - Not Found</h2>
        <p className="text-xl text-slate-600 mb-8 max-w-md mx-auto">
          We couldn&apos;t find the page you&apos;re looking for. It might have been moved or removed.
        </p>
        <Link href="/" className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30">
          Return Home
        </Link>
      </main>
      <LandingFooter />
    </div>
  )
}
