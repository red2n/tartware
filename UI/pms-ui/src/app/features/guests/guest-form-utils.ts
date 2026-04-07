const PHONE_REGEX = /^\+?[\d\s()\-.]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
	const val = email.trim();
	if (!val) return "Email is required";
	if (!EMAIL_REGEX.test(val)) return "Enter a valid email address";
	return null;
}

export function validatePhone(phone: string): string | null {
	const val = phone.trim();
	if (!val) return null;
	if (!PHONE_REGEX.test(val))
		return "Phone may only contain digits, spaces, +, -, (, ), and .";
	const digits = val.replace(/\D/g, "");
	if (digits.length < 10 || digits.length > 15)
		return "Phone must contain 10\u201315 digits (e.g. +1 415-555-1234)";
	return null;
}

export function hasFieldError(
	fieldErrors: Record<string, string>,
	field: string,
): boolean {
	return !!fieldErrors[field];
}

export function getFieldError(
	fieldErrors: Record<string, string>,
	field: string,
): string {
	return fieldErrors[field] ?? "";
}
