import DOMPurify from "dompurify";
import { ALLOWED_ATTR, ALLOWED_TAGS } from "@az-refresh/shared";

type Props = {
  html: string;
};

export function SafeHtml({ html }: Props) {
  const clean = DOMPurify.sanitize(html || "<em>No description provided.</em>", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false
  });
  return <div className="description-box p-3" dangerouslySetInnerHTML={{ __html: clean }} />;
}
