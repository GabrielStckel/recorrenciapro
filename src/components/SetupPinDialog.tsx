import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Check, AlertCircle } from 'lucide-react';

interface SetupPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (pin: string) => void;
  isUpdate?: boolean;
}

export function SetupPinDialog({ 
  open, 
  onOpenChange, 
  onConfirm,
  isUpdate = false
}: SetupPinDialogProps) {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (open) {
      setStep('enter');
      setPin(['', '', '', '']);
      setConfirmPin(['', '', '', '']);
      setError('');
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    }
  }, [open]);

  const currentPin = step === 'enter' ? pin : confirmPin;
  const setCurrentPin = step === 'enter' ? setPin : setConfirmPin;

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPin = [...currentPin];
    newPin[index] = value.slice(-1);
    setCurrentPin(newPin);
    setError('');

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Move to confirm step or validate
    if (value && index === 3 && newPin.every(d => d !== '')) {
      if (step === 'enter') {
        setStep('confirm');
        setConfirmPin(['', '', '', '']);
        setTimeout(() => inputRefs[0].current?.focus(), 100);
      } else {
        // Check if PINs match
        if (newPin.join('') === pin.join('')) {
          onConfirm(newPin.join(''));
        } else {
          setError('Os PINs não coincidem');
          setConfirmPin(['', '', '', '']);
          setTimeout(() => inputRefs[0].current?.focus(), 100);
        }
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !currentPin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            {step === 'enter' ? (
              <Lock className="w-6 h-6 text-primary" />
            ) : (
              <Check className="w-6 h-6 text-primary" />
            )}
          </div>
          <DialogTitle>
            {isUpdate ? 'Alterar PIN' : 'Configurar PIN'}
          </DialogTitle>
          <DialogDescription>
            {step === 'enter' 
              ? 'Crie um PIN de 4 dígitos para confirmar pagamentos'
              : 'Digite o PIN novamente para confirmar'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-3 my-6">
          {currentPin.map((digit, index) => (
            <Input
              key={`${step}-${index}`}
              ref={inputRefs[index]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-2xl font-bold"
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm justify-center">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${step === 'enter' ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`w-2 h-2 rounded-full ${step === 'confirm' ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        <Button 
          variant="outline" 
          className="w-full mt-2" 
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
