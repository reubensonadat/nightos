import React, { useRef } from 'react'

interface OtpInputProps {
    length?: number;
    value: string;
    onChange: (val: string) => void;
    onComplete?: (val: string) => void;
    disabled?: boolean;
    inputClassName?: string;
}

/**
 * OtpInput â€” accessible 6-digit code input.
 *
 * - Large, clearly-visible boxes (warm-gray surface) so they never
 *   disappear on a light background.
 * - Smart paste: pasting "123456" into any box distributes the digits
 *   across all boxes left-to-right.
 * - Smart typing: if a mobile keyboard delivers several digits at once
 *   into one box, they're distributed too.
 * - Auto-advance, backspace navigation, and arrow-key navigation.
 * - Auto-submit (via onComplete) the moment the last digit is filled.
 *
 * Lifted into its own component so it can be shared between the Auth
 * page and the dedicated /verify-otp page.
 */
export default function OtpInput({
    length = 6,
    value,
    onChange,
    onComplete,
    disabled,
    inputClassName,
}: OtpInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Normalise the incoming value into a fixed-length array of single
    // chars (empty string when unset).
    const digits = Array.from({ length }, (_, i) => value[i] || '')

    const focusSlot = (idx: number) => {
        const target = Math.max(0, Math.min(idx, length - 1))
        const el = inputRefs.current[target]
        if (el) {
            el.focus()
            el.select()
        }
    }

    // Commit a new full value and auto-submit once it's complete.
    const commit = (nextJoined: string) => {
        const clean = nextJoined.slice(0, length)
        onChange(clean)
        if (clean.length === length && onComplete) onComplete(clean)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const raw = e.target.value.replace(/\D/g, '')
        if (!raw) return // ignore non-numeric / empty input

        const chars = raw.split('')
        const next = digits.slice()

        // Distribute incoming chars starting at the current slot.
        let writeIdx = index
        for (const ch of chars) {
            if (writeIdx >= length) break
            next[writeIdx] = ch
            writeIdx++
        }

        commit(next.join(''))
        focusSlot(writeIdx >= length ? length - 1 : writeIdx)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace') {
            e.preventDefault()
            const next = digits.slice()
            if (next[index]) {
                // Clear the current slot.
                next[index] = ''
                commit(next.join(''))
            } else if (index > 0) {
                // Nothing here â€” step back and clear the previous slot.
                next[index - 1] = ''
                commit(next.join(''))
                focusSlot(index - 1)
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            focusSlot(index - 1)
        } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            focusSlot(index + 1)
        }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault()
        const clip = e.clipboardData || (window as Window & { clipboardData?: DataTransfer }).clipboardData
        const pasted = (clip ? clip.getData('text') : '').replace(/\D/g, '').slice(0, length)
        if (!pasted) return

        const next = digits.slice()
        for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
        commit(next.join(''))
        focusSlot(Math.min(pasted.length, length - 1))
    }

    return (
        <div className="flex justify-between gap-2 sm:gap-3">
            {digits.map((d, i) => (
                <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={d}
                    onChange={(e) => handleChange(e, i)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    onPaste={handlePaste}
                    onFocus={(e) => e.target.select()}
                    disabled={disabled}
                    className={
                        inputClassName ||
                        'flex-1 min-w-0 h-14 sm:h-16 text-center text-2xl sm:text-3xl font-display font-medium text-[var(--color-foreground)] bg-[var(--color-background)] border-2 border-[var(--color-border)] rounded-2xl focus:border-[#111] focus:bg-[var(--color-surface)] focus:ring-2 focus:ring-[#111]/15 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed'
                    }
                />
            ))}
        </div>
    )
}
