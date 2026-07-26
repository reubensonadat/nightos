import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { authDb } from '../../lib/db/auth'

const OTP_STORAGE_KEY = 'nightos:otp_pending'
const OTP_COOLDOWN_SECONDS = 60

type Props = {
  isLogin: boolean
  onSwitchMethod: () => void
  onToggleMode: () => void
}

export function PhoneAuthForm({ isLogin, onSwitchMethod, onToggleMode }: Props) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signInWithPhone } = useAuth()
  const navigate = useNavigate()

  const [cooldown, setCooldown] = useState(() => {
    try {
      const raw = sessionStorage.getItem(OTP_STORAGE_KEY)
      if (raw) {
        const { sentAt } = JSON.parse(raw)
        const elapsed = Math.floor((Date.now() - (sentAt || 0)) / 1000)
        const remaining = OTP_COOLDOWN_SECONDS - elapsed
        return remaining > 0 ? remaining : 0
      }
    } catch {}
    return 0
  })

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const formatPhone = (raw: string): string => {
    let f = raw.trim()
    if (f.startsWith('0')) f = '+233' + f.slice(1)
    else if (f.startsWith('233')) f = '+' + f
    else if (!f.startsWith('+')) f = '+' + f
    return f
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cooldown > 0) return
    setError(null)
    setLoading(true)

    const formattedPhone = formatPhone(phone)

    const { data: phoneExists } = await authDb.checkPhoneExists(formattedPhone)
    const { data: staffData } = await authDb.venueByStaffPhone(formattedPhone)
    const isStaff = !!staffData

    if (isLogin && !phoneExists && !isStaff) {
      setError("This phone number doesn't exist. Create a venue first.")
      setLoading(false)
      return
    }

    if (!isLogin && phoneExists) {
      setError('An account with this phone already exists. Sign in instead.')
      setLoading(false)
      return
    }

    const { error } = await signInWithPhone(formattedPhone)
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      sessionStorage.setItem(
        OTP_STORAGE_KEY,
        JSON.stringify({ phone: formattedPhone, mode: isLogin ? 'login' : 'signup', sentAt: Date.now() }),
      )
      navigate('/verify-otp', { replace: true })
    }
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold tracking-tight text-licorice">
          {isLogin ? 'Sign in' : 'Create your venue'}
        </h2>
        <p className="text-[12px] tracking-tight text-feldgrau mt-1">
          {isLogin ? 'Enter your phone number to continue.' : 'Join NightOS in 5 minutes.'}
        </p>
      </div>

      <form onSubmit={handleSendOtp} className="space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Phone number</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233 24 123 4567"
              autoComplete="tel"
              className="flex-1 min-w-0 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || cooldown > 0}
          className="w-full rounded-full bg-licorice px-5 py-3.5 text-[13px] font-bold text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] transition-all hover:bg-licorice/95 active:scale-[0.985] disabled:opacity-80"
        >
          {loading ? 'Sending code...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Continue with Phone'}
        </button>
      </form>

      <div className="mt-6 relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-licorice/8" /></div>
        <div className="relative flex justify-center"><span className="bg-isabelline px-3 text-[10px] font-medium uppercase tracking-wider text-feldgrau">Or</span></div>
      </div>

      <div className="mt-6 text-center">
        <button onClick={onSwitchMethod} className="text-[12px] font-semibold text-feldgrau hover:text-licorice transition-colors">
          Continue with Email instead
        </button>
      </div>

      <div className="mt-6 text-center text-[12px] text-feldgrau">
        {isLogin ? "Don't have a venue yet? " : 'Already have a venue? '}
        <button onClick={onToggleMode} className="font-semibold text-licorice hover:underline">
          {isLogin ? "Create one — it's free" : 'Sign in'}
        </button>
      </div>
    </div>
  )
}
