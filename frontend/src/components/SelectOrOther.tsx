type Props = {
  label: string;
  value: string;
  otherValue: string;
  options: string[];
  onChange: (value: string) => void;
  onOtherChange: (value: string) => void;
};

export function SelectOrOther({
  label,
  value,
  otherValue,
  options,
  onChange,
  onOtherChange,
}: Props) {
  const isOther = value === "Other";

  return (
    <div className="field">
      <label htmlFor={`select-${label}`}>{label}</label>
      <select
        id={`select-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose…</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {isOther && (
        <input
          type="text"
          placeholder="Type name…"
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          style={{ marginTop: "0.5rem" }}
          autoFocus
        />
      )}
    </div>
  );
}
