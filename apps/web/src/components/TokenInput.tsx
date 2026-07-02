type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function TokenInput({ label, value, onChange }: Props) {
  return (
    <label className="form-label w-100">
      {label}
      <input
        className="form-control mt-1"
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste token"
      />
    </label>
  );
}
