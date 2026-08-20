import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth, sectorPath } from '../../context/AuthContext'

const OTP_STORAGE_KEY = 'nightos:otp_pending'
const OTP_COOLDOWN_SECONDS = 60

function OtpInput({ length, value, onChange, onComplete, disabled }: {
  length: number
  value: string
  onChange: (v: string) => void
  onComplete: (v: string) => void
  disabled: boolean
}) {
  const handleChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, length)
    onChange(digits)
    if (digits.length === length) onComplete(digits)
  }

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => {
            const newVal = value.split('')
            newVal[i] = e.target.value.replace(/\D/g, '')
            handleChange(newVal.join(''))
            if (e.target.value && i < length - 1) {
              const next = document.querySelector<HTMLInputElement>(`[data-otp="${i + 1}"]`)
              next?.focus()
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) {
              const prev = document.querySelector<HTMLInputElement>(`[data-otp="${i - 1}"]`)
              prev?.focus()
            }
          }}
          data-otp={i}
          disabled={disabled}
          className="w-11 h-12 text-center text-lg font-bold rounded-md bg-isabelline text-licorice ring-1 ring-licorice/8 focus:outline-none focus:ring-2 focus:ring-licorice/20 disabled:opacity-50"
        />
      ))}
    </div>
  )
}

export function VerifyOtpScreen() {
  const navigate = useNavigate()
  const { verifyPhoneOtp, signInWithPhone, role, staffSession } = useAuth()

  const [pending] = useState(() => {
    try {
      const raw = sessionStorage.getItem(OTP_STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  const phone = pending?.phone || ''
  const mode = pending?.mode === 'signup' ? 'signup' : 'login'

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cooldown, setCooldown] = useState(() => {
    const sentAt = pending?.sentAt
    if (!sentAt) return 0
    const elapsed = Math.floor((Date.now() - sentAt) / 1000)
    return Math.max(0, OTP_COOLDOWN_SECONDS - elapsed)
  })

  useEffect(() => {
    if (!pending?.phone) navigate('/login', { replace: true })
  }, [pending, navigate])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handleVerify = async (e?: React.FormEvent, autoSubmitOtp?: string) => {
    if (e) e.preventDefault()
    const otpToVerify = autoSubmitOtp || otp
    if (!otpToVerify || otpToVerify.length !== 6) return

    setError(null)
    setLoading(true)
    const { error } = await verifyPhoneOtp(phone, otpToVerify)
    setLoading(false)

    if (error) {
      setError(error.message)
      toast.error(error.message)
    } else {
      toast.success('Verified! Welcome back.')
      sessionStorage.removeItem(OTP_STORAGE_KEY)
      navigate(sectorPath(staffSession?.role ?? role), { replace: true })
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || resending) return
    setError(null)
    setResending(true)
    const { error } = await signInWithPhone(phone)
    setResending(false)
    if (error) {
      setError(error.message)
      toast.error(error.message)
    } else {
      toast.success('Code resent. Check your phone.')
      sessionStorage.setItem(
        OTP_STORAGE_KEY,
        JSON.stringify({ phone, mode, sentAt: Date.now() }),
      )
      setCooldown(OTP_COOLDOWN_SECONDS)
      setOtp('')
    }
  }

  if (!pending?.phone) return null

  return (
    <div className="relative min-h-svh w-full bg-isabelline font-sans text-licorice antialiased flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-licorice text-isabelline">
            <span className="font-serif text-[22px] font-bold">B</span>
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-licorice">Verify your number</h1>
          <p className="text-[12px] tracking-tight text-feldgrau mt-1">
            Enter the 6-digit code sent to <span className="font-semibold text-licorice">{phone}</span>.
          </p>
        </div>

        <form onSubmit={(e) => handleVerify(e)} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau text-center">Verification Code</label>
            <OtpInput
              length={6}
              value={otp}
              onChange={setOtp}
              onComplete={(val) => handleVerify(undefined, val)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-700">{error}</div>
          )}

          <button type="submit" disabled={loading || otp.length !== 6}
            className="w-full rounded-full bg-licorice px-5 py-3.5 text-[13px] font-bold text-isabelline shadow-[0_12px_28px_rgba(35,20,12,0.20)] transition-all hover:bg-licorice/95 active:scale-[0.985] disabled:opacity-80">
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>

        <div className="mt-6 text-center text-[12px] text-feldgrau">
          {cooldown > 0 ? (
            <span>Resend code in <span className="font-semibold text-licorice">{cooldown}s</span></span>
          ) : (
            <button type="button" onClick={handleResend} disabled={resending}
              className="font-semibold text-licorice hover:underline disabled:opacity-50">
              {resending ? 'Sending...' : "Didn't get a code? Resend"}
            </button>
          )}
        </div>

        <div className="mt-6 text-center">
          <button type="button" onClick={() => { sessionStorage.removeItem(OTP_STORAGE_KEY); navigate('/login', { replace: true }) }}
            className="text-[12px] font-medium text-feldgrau hover:text-licorice transition-colors">
            Change phone number
          </button>
        </div>
      </div>
    </div>
  )
}
