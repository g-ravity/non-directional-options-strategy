export const getFormattedDate = (dateString: string): string => {
	const [dd, mm, yyyy] = dateString.split('-');
	const updatedDate = `${mm}-${dd}-${yyyy}`;

	return updatedDate;
};

export const addZeroPadding = (num: number): string => (num < 10 ? `0${num}` : num.toString());

export const isNotEmptyObject = (obj: any) => obj && Object.keys(obj).length > 0;
