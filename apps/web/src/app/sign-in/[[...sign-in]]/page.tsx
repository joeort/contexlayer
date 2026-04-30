import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-500">
      <div className="text-center mb-8">
        <div className="flex flex-col items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Context Layer</h1>
            <p className="text-teal-300 text-sm mt-1">Implementation Dashboard</p>
          </div>
          <SignIn
            appearance={{
              elements: {
                card: 'shadow-xl',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
