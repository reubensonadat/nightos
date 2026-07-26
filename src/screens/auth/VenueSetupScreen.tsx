import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { authDb } from '../../lib/db/auth'

export function VenueSetupScreen() {
  const navigate = useNavigate()
  const { user, venue, refreshVenue } = useAuth()

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [slugChecking, setSlugChecking] = useState(false)
  const [slugTaken, setSlugTaken] = useState(false)

  useEffect(() => {
    if (venue) navigate('/dashboard', { replace: true })
  }, [venue, navigate])

  useEffect(() => {
    if (step !== 1 || slug) return
    const generated = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (generated) setSlug(generated)
  }, [step, name, slug])

  useEffect(() => {
    if (!slug || slug.length < 3) { setSlugTaken(false); return }
    setSlugChecking(true)
    const timer = setTimeout(async () => {
      const { data } = await authDb.slugAvailable(slug)
      setSlugTaken((data as any[] | null)?.length ? true : false)
      setSlugChecking(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [slug])

  const slugValid = slug.length >= 3 && /^[a-z0-9-]+$/.test(slug) && !slugTaken && !slugChecking
  const canAdvance = name.trim().length >= 2

  const handleCreate = async () => {
    if (!user) return
    setSubmitting(true)
    const { error } = await authDb.createVenue(user.id, name.trim(), slug)
    setSubmitting(false)
    if (error) return
    await refreshVenue()
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="relative min-h-svh w-full bg-isabelline font-sans text-licorice antialiased flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-feldgrau">
            Onboarding · Step {step + 1} of 2
          </p>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-licorice">
            {step === 0 ? "What's your venue called?" : 'Pick your URL'}
          </h1>
          <p className="text-[12px] text-feldgrau mt-1">
            {step === 0 ? 'Give your nightclub or bar a name.' : 'Choose a unique link for your venue.'}
          </p>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Venue Name</label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
                <input type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canAdvance && setStep(1)}
                  placeholder="e.g. Velvet Lounge"
                  autoFocus
                  className="flex-1 min-w-0 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none" />
              </div>
            </div>
            <button onClick={() => setStep(1)} disabled={!canAdvance}
              className="w-full rounded-full bg-licorice px-5 py-3.5 text-[13px] font-bold text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-[0.985] disabled:opacity-40">
              Continue
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-feldgrau">Venue URL</label>
              <div className="mt-1.5">
                <div className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-licorice/8 focus-within:ring-2 focus-within:ring-licorice/20">
                  <span className="text-[12px] text-feldgrau">nightos.app/</span>
                  <input type="text" value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="velvet-lounge"
                    autoFocus
                    className="flex-1 min-w-0 bg-transparent text-[13px] text-licorice placeholder:text-feldgrau/50 focus:outline-none font-mono" />
                </div>
                {slug.length >= 3 && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {slugChecking ? (
                      <span className="text-[11px] text-feldgrau">Checking...</span>
                    ) : slugTaken ? (
                      <span className="text-[11px] text-red-600">Taken</span>
                    ) : (
                      <span className="text-[11px] text-emerald-600">Available</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(0)}
                className="flex-1 rounded-full bg-white px-5 py-3.5 text-[13px] font-bold text-licorice ring-1 ring-licorice/8 hover:bg-isabelline transition-all">
                Back
              </button>
              <button onClick={handleCreate} disabled={!slugValid || submitting}
                className="flex-1 rounded-full bg-licorice px-5 py-3.5 text-[13px] font-bold text-isabelline shadow-sm transition-all hover:bg-licorice/95 active:scale-[0.985] disabled:opacity-40">
                {submitting ? 'Creating...' : 'Create Venue'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
