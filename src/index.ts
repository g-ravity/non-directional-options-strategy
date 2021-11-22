import 'dotenv-safe/config';
import Papa, { ParseResult } from 'papaparse';
import fs from 'fs';
import { homedir } from 'os';

interface IOptionData {
	Ticker: string;
	'Date/Time': string;
	Open: number;
	High: number;
	Low: number;
	Close: number;
	Volume: number;
	'Open Interest': number;
}

const filePath = 'Downloads/Telegram Desktop/11-18-Nov- -W-ExpiryWEEKdata_2021_NF_BNF_options_vege.csv';

fs.readFile(`${homedir}/${filePath}`, 'utf8', (err, data) => {
	if (err) {
		console.error(err);
		return;
	}

	Papa.parse<IOptionData>(data, {
		header: true,
		dynamicTyping: true,
		complete: (results: ParseResult<IOptionData>) => {
			console.log(results.data.length);
			results.data.map((item, index) => {
				if (index < 10) console.log(item.Ticker + '---' + item['Date/Time'].split(' ').pop() + '----' + item.Close);
			});
		},
		error: (err: Error) => console.log('Something went wrong while parsing! \n', err),
		fastMode: true,
	});
});
