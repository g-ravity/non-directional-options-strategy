export interface IOptionData {
	Ticker: string;
	'Date/Time': string;
	Open: number;
	High: number;
	Low: number;
	Close: number;
	Volume: number;
	'Open Interest': number;
}

export interface IActivePosition {
	[key: string]: 'buy' | 'sell';
}
