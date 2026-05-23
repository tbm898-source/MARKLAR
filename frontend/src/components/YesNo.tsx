type Props = {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
};

export function YesNo({ label, value, onChange }: Props) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="yes-no">
        <button
          type="button"
          className={value === true ? "selected" : ""}
          onClick={() => onChange(true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={value === false ? "selected" : ""}
          onClick={() => onChange(false)}
        >
          No
        </button>
      </div>
    </div>
  );
}
