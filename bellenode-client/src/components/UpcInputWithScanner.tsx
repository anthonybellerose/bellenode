import { useState } from 'react';
import BarcodeScanner from './BarcodeScanner';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
  type?: 'text' | 'search';
}

export default function UpcInputWithScanner({
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
  className,
  inputClassName,
  type = 'text',
}: Props) {
  const [open, setOpen] = useState(false);
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  return (
    <>
      <div className={`flex gap-2 ${className ?? ''}`}>
        <input
          type={type}
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`flex-1 font-mono ${inputClassName ?? ''}`}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          aria-label={supported ? 'Scanner avec la caméra' : 'Caméra non supportée'}
          title={supported ? 'Scanner' : 'Caméra non supportée sur ce navigateur'}
          className={`btn px-3 flex-shrink-0 ${supported ? 'btn-secondary' : 'btn-ghost opacity-60'}`}
        >
          📷
        </button>
      </div>

      {open && (
        <BarcodeScanner
          mode="+"
          onModeChange={() => {}}
          showModeSwitch={false}
          onDetect={(code) => {
            onChange(code);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
