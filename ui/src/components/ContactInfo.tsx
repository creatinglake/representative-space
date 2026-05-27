import type { ContactChannels } from "../services/api.ts";
import "./ContactInfo.css";

interface Props {
  channels: ContactChannels;
}

export default function ContactInfo({ channels }: Props) {
  const hasAny = channels.phone || channels.email || channels.office_address;
  if (!hasAny) return null;

  return (
    <div className="contact-info">
      <h4 className="contact-info-heading">Contact</h4>
      <ul className="contact-info-list">
        {channels.email && (
          <li>
            <a href={`mailto:${channels.email}`}>{channels.email}</a>
          </li>
        )}
        {channels.phone && (
          <li>
            <a href={`tel:${channels.phone}`}>{channels.phone}</a>
          </li>
        )}
        {channels.office_address && <li>{channels.office_address}</li>}
      </ul>
    </div>
  );
}
