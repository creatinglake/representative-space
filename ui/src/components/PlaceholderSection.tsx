import "./PlaceholderSection.css";

interface Props {
  title: string;
  description?: string;
}

export default function PlaceholderSection({ title, description }: Props) {
  return (
    <section className="placeholder-section">
      <h3 className="placeholder-section-title">{title}</h3>
      {description && (
        <p className="placeholder-section-desc">{description}</p>
      )}
    </section>
  );
}
