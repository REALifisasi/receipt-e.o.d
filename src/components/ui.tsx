import type { ReactNode, TextareaHTMLAttributes, InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export const Field = ({ label, hint, ...props }: FieldProps) => (
  <label className="field">
    <span className="field__label">{label}</span>
    <input className="field__input" {...props} />
    {hint ? <span className="field__hint">{hint}</span> : null}
  </label>
);

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const TextArea = ({ label, ...props }: TextAreaProps) => (
  <label className="field">
    <span className="field__label">{label}</span>
    <textarea className="field__input" rows={3} {...props} />
  </label>
);

interface CardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

export const Card = ({ title, icon, children, actions }: CardProps) => (
  <section className="card">
    <header className="card__header">
      <h2 className="card__title">
        {icon}
        {title}
      </h2>
      {actions ? <div className="card__actions">{actions}</div> : null}
    </header>
    <div className="card__body">{children}</div>
  </section>
);
