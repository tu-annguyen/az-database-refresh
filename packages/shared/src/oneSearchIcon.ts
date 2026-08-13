export const ONESEARCH_ICON_HTML =
  '<img src="https://libapps.s3.amazonaws.com/accounts/7085/images/SmallOneSearchO.png" alt="Covered in OneSearch" title="Covered in OneSearch">';

export const ONESEARCH_RESOURCE_ICON_ID = "37359";
export const ARTIFICIAL_INTELLIGENCE_RESOURCE_ICON_ID = "37352";

const ONESEARCH_ICON_PATTERN =
  /<img\b(?=[^>]*\bsrc\s*=\s*["']https:\/\/libapps\.s3\.amazonaws\.com\/accounts\/7085\/images\/SmallOneSearchO\.png["'])[^>]*>/gi;

export function hasOneSearchIcon(html: string): boolean {
  ONESEARCH_ICON_PATTERN.lastIndex = 0;
  return ONESEARCH_ICON_PATTERN.test(html);
}

export function removeOneSearchIcon(html: string): string {
  return html.replace(ONESEARCH_ICON_PATTERN, "").trim();
}

export function setOneSearchIcon(html: string, included: boolean): string {
  if (included && hasOneSearchIcon(html)) return html;
  const withoutIcon = removeOneSearchIcon(html);
  if (!included) return withoutIcon;
  return `${ONESEARCH_ICON_HTML}${withoutIcon ? `\n${withoutIcon}` : ""}`;
}
