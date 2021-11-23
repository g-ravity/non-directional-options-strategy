export const getFormattedDate = (dateString: string): string => {
	const [dd, mm, yyyy] = dateString.split('-');
	const updatedDate = `${mm}-${dd}-${yyyy}`;

	return updatedDate;
};
