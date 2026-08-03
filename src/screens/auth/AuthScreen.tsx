import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PhoneAuthForm } from './PhoneAuthForm'
import { EmailLoginForm } from './EmailLoginForm'
import { SignupForm } from './SignupForm'

type Props = {
  initialMode?: 'login' | 'signup'
}

export function AuthScreen({ initialMode = 'login' }: Props) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login')
  const [authMethod, setAuthMethod] = useState<'phone' | 'email'>('phone')
  const [prefillEmail, setPrefillEmail] = useState('')
  const { session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) navigate('/manager', { replace: true })
  }, [session, navigate])

  const toggleMode = () => setIsLogin((v) => !v)

  const handlePrefillSignIn = (email: string) => {
    setPrefillEmail(email)
    setIsLogin(true)
    setAuthMethod('email')
  }

  return (
    <div className="relative min-h-svh w-full bg-isabelline font-sans text-licorice antialiased flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-licorice text-isabelline shadow-[0_8px_24px_rgba(35,20,12,0.20)]">
              <span className="font-serif text-[22px] font-bold leading-none tracking-tight">B</span>
            </div>
            <h1 className="mt-4 font-serif text-2xl font-bold tracking-tight text-licorice">Bysen</h1>
            <p className="text-[12px] tracking-tight text-feldgrau mt-1">Venue management platform</p>
          </div>

          {authMethod === 'phone' ? (
            <PhoneAuthForm
              isLogin={isLogin}
              onSwitchMethod={() => setAuthMethod('email')}
              onToggleMode={toggleMode}
            />
          ) : isLogin ? (
            <EmailLoginForm
              initialEmail={prefillEmail}
              onSwitchMethod={() => setAuthMethod('phone')}
              onToggleMode={toggleMode}
            />
          ) : (
            <SignupForm
              onSwitchMethod={() => setAuthMethod('phone')}
              onToggleMode={toggleMode}
              onPrefillSignIn={handlePrefillSignIn}
            />
          )}
        </div>
      </div>
    </div>
  )
}
