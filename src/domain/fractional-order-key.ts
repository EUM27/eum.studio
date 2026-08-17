type FractionalOrderKeyParts = Readonly<{
  numerator: bigint;
  denominator: bigint;
}>;

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let currentLeft = left < 0n ? -left : left;
  let currentRight = right < 0n ? -right : right;
  while (currentRight !== 0n) {
    const remainder = currentLeft % currentRight;
    currentLeft = currentRight;
    currentRight = remainder;
  }
  return currentLeft === 0n ? 1n : currentLeft;
}

function parseFractionalOrderKey(value: string): FractionalOrderKeyParts {
  if (!/^-?(?:0|[1-9]\d*)\/[1-9]\d*$/.test(value)) {
    throw new Error(`Invalid fractional order key: ${value}`);
  }
  const separator = value.indexOf("/");
  const numerator = BigInt(value.slice(0, separator));
  const denominator = BigInt(value.slice(separator + 1));
  if (greatestCommonDivisor(numerator, denominator) !== 1n) {
    throw new Error(`Fractional order key is not canonical: ${value}`);
  }
  return Object.freeze({ numerator, denominator });
}

function formatFractionalOrderKey(
  numerator: bigint,
  denominator: bigint,
): string {
  if (denominator <= 0n) {
    throw new Error("Fractional order key denominator must be positive");
  }
  const divisor = greatestCommonDivisor(numerator, denominator);
  return `${numerator / divisor}/${denominator / divisor}`;
}

export function compareFractionalOrderKeys(
  left: string,
  right: string,
): number {
  const leftParts = parseFractionalOrderKey(left);
  const rightParts = parseFractionalOrderKey(right);
  const difference =
    leftParts.numerator * rightParts.denominator -
    rightParts.numerator * leftParts.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function createOrderKeyBetween(
  previousKey: string | null,
  nextKey: string | null,
): string {
  if (previousKey === null && nextKey === null) {
    return "0/1";
  }
  if (previousKey === null) {
    const next = parseFractionalOrderKey(nextKey as string);
    return formatFractionalOrderKey(
      next.numerator - next.denominator,
      next.denominator,
    );
  }
  if (nextKey === null) {
    const previous = parseFractionalOrderKey(previousKey);
    return formatFractionalOrderKey(
      previous.numerator + previous.denominator,
      previous.denominator,
    );
  }
  if (compareFractionalOrderKeys(previousKey, nextKey) >= 0) {
    throw new Error("Fractional order key neighbors must be strictly ordered");
  }
  const previous = parseFractionalOrderKey(previousKey);
  const next = parseFractionalOrderKey(nextKey);
  return formatFractionalOrderKey(
    previous.numerator + next.numerator,
    previous.denominator + next.denominator,
  );
}

export function createRebalancedOrderKeys(count: number): readonly string[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("Fractional order key count must be a non-negative integer");
  }
  return Object.freeze(
    Array.from({ length: count }, (_, index) => `${index}/1`),
  );
}
