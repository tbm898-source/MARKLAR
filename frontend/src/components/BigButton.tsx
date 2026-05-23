import { Link } from "react-router-dom";

type Props = {
  to?: string;
  onClick?: () => void;
  variant: "work" | "problem" | "need" | "secondary";
  children: React.ReactNode;
};

export function BigButton({ to, onClick, variant, children }: Props) {
  const className = `big-button big-button--${variant}`;
  if (to) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
