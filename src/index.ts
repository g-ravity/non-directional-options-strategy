import 'dotenv-safe/config';
import Papa, { ParseResult } from 'papaparse';
import fs from 'fs';
import { homedir } from 'os';
import greeks from 'greeks';

import { FILE_PATH, STRADDLE_SQ_OFF_TIME, STRADDLE_START_TIME, TICKERS_LIST } from './utils/constants';
import { IOptionData } from './types';

const onParseComplete = (results: ParseResult<IOptionData>) => {
	results.data.map((item, index) => {
		if (item.Ticker && TICKERS_LIST.some((ticker) => item.Ticker.includes(ticker)) && item.Ticker.split('WK').length === 2) {
			const [date, time] = item['Date/Time'].split(' ');
			const [dd, mm, yyyy] = date.split('-');
			const updatedDate = `${mm}-${dd}-${yyyy}`;

			const isAfterStartTime = new Date(`${updatedDate} ${time}`) >= new Date(`${updatedDate} ${STRADDLE_START_TIME}`);
			const isBeforeEndTime = new Date(`${updatedDate} ${time}`) <= new Date(`${updatedDate} ${STRADDLE_SQ_OFF_TIME}`);

			const [underlying, strike] = item.Ticker.split('WK');

			const ceDelta = greeks.getDelta(item.Open, +strike.slice(0, -2), 0.00822, 0.1742, 0.1, strike.slice(-2) === 'PE' ? 'put' : 'call');

			if (isAfterStartTime && isBeforeEndTime) console.log(item.Ticker + '---' + date + '--' + time + '----' + item.Close);
		}
	});
};

fs.readFile(`${homedir}/${FILE_PATH}`, 'utf8', (err, data) => {
	if (err) {
		console.error(err);
		return;
	}

	Papa.parse<IOptionData>(data, {
		header: true,
		dynamicTyping: true,
		complete: onParseComplete,
		error: (err: Error) => console.log('Something went wrong while parsing! \n', err),
		fastMode: true,
	});
});
