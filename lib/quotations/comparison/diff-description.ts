export type DescriptionDiffSegment = {
  text: string;
  type: "unchanged" | "added" | "removed";
};

function tokens(value: string) {
  return value.replace(/\s+/g, " ").trim().match(/\S+|\s+/g) ?? [];
}

function abbreviatedDiff(left: string[], right: string[]) {
  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < left.length - prefix &&
    suffix < right.length - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  ) suffix += 1;

  const commonStart = left.slice(0, prefix).join("");
  const commonEnd = suffix ? left.slice(left.length - suffix).join("") : "";
  return {
    revisionA: [
      ...(commonStart ? [{ text: commonStart, type: "unchanged" as const }] : []),
      ...(left.length > prefix + suffix
        ? [{ text: left.slice(prefix, left.length - suffix).join(""), type: "removed" as const }]
        : []),
      ...(commonEnd ? [{ text: commonEnd, type: "unchanged" as const }] : []),
    ],
    revisionB: [
      ...(commonStart ? [{ text: commonStart, type: "unchanged" as const }] : []),
      ...(right.length > prefix + suffix
        ? [{ text: right.slice(prefix, right.length - suffix).join(""), type: "added" as const }]
        : []),
      ...(commonEnd ? [{ text: commonEnd, type: "unchanged" as const }] : []),
    ],
  };
}

export function diffDescription(revisionA: string | null, revisionB: string | null) {
  const left = tokens(revisionA ?? "");
  const right = tokens(revisionB ?? "");
  if (left.join("") === right.join("")) {
    const text = left.join("");
    return {
      revisionA: text ? [{ text, type: "unchanged" as const }] : [],
      revisionB: text ? [{ text, type: "unchanged" as const }] : [],
    };
  }

  // Bound quadratic work for unusually large rich-text descriptions.
  if (left.length * right.length > 250_000) return abbreviatedDiff(left, right);

  const matrix = Array.from({ length: left.length + 1 }, () =>
    new Uint16Array(right.length + 1),
  );
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      matrix[i][j] = left[i] === right[j]
        ? matrix[i + 1][j + 1] + 1
        : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }

  const leftResult: DescriptionDiffSegment[] = [];
  const rightResult: DescriptionDiffSegment[] = [];
  const append = (target: DescriptionDiffSegment[], text: string, type: DescriptionDiffSegment["type"]) => {
    const previous = target.at(-1);
    if (previous?.type === type) previous.text += text;
    else target.push({ text, type });
  };
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      append(leftResult, left[i], "unchanged");
      append(rightResult, right[j], "unchanged");
      i += 1;
      j += 1;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      append(leftResult, left[i], "removed");
      i += 1;
    } else {
      append(rightResult, right[j], "added");
      j += 1;
    }
  }
  while (i < left.length) append(leftResult, left[i++], "removed");
  while (j < right.length) append(rightResult, right[j++], "added");
  return { revisionA: leftResult, revisionB: rightResult };
}

