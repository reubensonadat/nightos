import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

type Props = {
  onSwitchMethod: () => void
  onToggleMode: () => void
}

export function SignupForm({ onSwitchMethod, onToggleMode }: Props) {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signUp(email, password)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/setup', { replace: true })
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold tracking-tight text-licorice">Create your venue</h2>
        <p className="text-[12px] tracking-tight text-feldgrau mt-1">Join NightOS and start managing in 5 minutes.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Email</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="username"
              className="flex-1 min-w-0 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Password</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
            <input type={showPassword ? 'text' : 'password'} required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password"
              autoComplete="new-password"
              className="flex-1 min-w-0 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none" />
            <button type="button" onClick={() => setShowPassword((v) => !v)}
              className="text-[10px] font-bold uppercase tracking-wider text-feldgrau hover:text-licorice">
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-700">{error}</div>
        )}

        <button type="submit" disabled={loading}
          className="w-full rounded-full bg-licorice px-5 py-3.5 text-[13px] font-bold text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] transition-all hover:bg-licorice/95 active:scale-[0.985] disabled:opacity-80">
          {loading ? 'Creating account...' : 'Create free account'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button onClick={onSwitchMethod} className="text-[12px] font-semibold text-feldgrau hover:text-licorice transition-colors">
          Use Phone Number instead
        </button>
      </div>

      <div className="mt-6 text-center text-[12px] text-feldgrau">
        Already have a venue?{' '}
        <button onClick={onToggleMode} className="font-semibold text-licorice hover:underline">Sign in</button>
      </div>
    </div>
  )
}
