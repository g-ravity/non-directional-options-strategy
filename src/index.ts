import 'dotenv-safe/config';
import Papa, { ParseResult } from 'papaparse';
import fs from 'fs';
import { homedir } from 'os';
import greeks from 'greeks';
import findLastIndex from 'lodash/findIndex';
import find from 'lodash/find';
import differenceInDays from 'date-fns/differenceInDays';

import { FILE_PATH, INTEREST_RATE, STRADDLE_SQ_OFF_TIME, STRADDLE_START_TIME, TICKERS_LIST } from './utils/constants';
import { IOptionData } from './types';
import { getFormattedDate } from './utils/commonHelpers';

const onParseComplete = (results: ParseResult<IOptionData>) => {
	const optionsData = results.data;

	optionsData.map((item, index) => {
		if (item.Ticker && TICKERS_LIST.some((ticker) => item.Ticker.includes(ticker)) && item.Ticker.split('WK').length === 2) {
			const [date, time] = item['Date/Time'].split(' ');
			const updatedDate = getFormattedDate(date);

			const isAfterStartTime = new Date(`${updatedDate} ${time}`) >= new Date(`${updatedDate} ${STRADDLE_START_TIME}`);
			const isBeforeEndTime = new Date(`${updatedDate} ${time}`) <= new Date(`${updatedDate} ${STRADDLE_SQ_OFF_TIME}`);

			const [underlying, strike] = item.Ticker.split('WK');
			// console.log(item.Ticker, date, time, isAfterStartTime, isBeforeEndTime);

			const { Open: underlyingPrice } =
				find(optionsData, { Ticker: underlying, 'Date/Time': item['Date/Time'] }) ?? find(optionsData, { Ticker: underlying, 'Date/Time': optionsData[index - 1]['Date/Time'] });
			const { Open: volatility } =
				find(optionsData, { Ticker: 'INDIAVIX', 'Date/Time': item['Date/Time'] }) ?? find(optionsData, { Ticker: 'INDIAVIX', 'Date/Time': optionsData[index - 1]['Date/Time'] });
			const { 'Date/Time': expiryDateTime } = optionsData[findLastIndex(optionsData, (data) => data.Ticker === 'BANKNIFTY')];
			const daysToExpiry = differenceInDays(new Date(getFormattedDate(expiryDateTime.split(' ')[0])), new Date(updatedDate));

			const delta = greeks.getDelta(+underlyingPrice, +strike.slice(0, -2), daysToExpiry / 365, +volatility / 100, INTEREST_RATE / 100, strike.slice(-2) === 'PE' ? 'put' : 'call');

			if (isAfterStartTime && isBeforeEndTime) console.log(item.Ticker + '---' + date + '--' + time + '----' + item.Open + '---' + delta);
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
