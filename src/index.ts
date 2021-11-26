import 'dotenv-safe/config';
import Papa, { ParseResult } from 'papaparse';
import fs from 'fs';
import { homedir } from 'os';
import greeks from 'greeks';
import findLastIndex from 'lodash/findLastIndex';
import find from 'lodash/find';
import differenceInDays from 'date-fns/differenceInDays';

import { FILE_PATH, INTEREST_RATE, STRADDLE_SQ_OFF_TIME, STRADDLE_START_TIME, TICKERS_LIST } from './utils/constants';
import { IOptionData } from './types';
import { getFormattedDate } from './utils/commonHelpers';

const onParseComplete = (results: ParseResult<IOptionData>) => {
	const optionsData = results.data;

	optionsData.map((item, index) => {
		let tradeDate = '';
		let straddleEntryValue: number;
		const dateTime = item['Date/Time'] ? item['Date/Time'].split(' ') : undefined;
		if (dateTime && dateTime?.[0] !== tradeDate) tradeDate = dateTime?.[0];

		if (dateTime && item.Ticker && TICKERS_LIST.includes(item.Ticker)) {
			const updatedDate = getFormattedDate(tradeDate);
			const time = dateTime?.[1];

			const isAfterStartTime = new Date(`${updatedDate} ${time}`) >= new Date(`${updatedDate} ${STRADDLE_START_TIME}`);
			const isBeforeEndTime = new Date(`${updatedDate} ${time}`) <= new Date(`${updatedDate} ${STRADDLE_SQ_OFF_TIME}`);

			while (isBeforeEndTime) {
				if (isAfterStartTime) {
					const strike = Math.round(+item.Open / 100) * 100;
					const CEStrike = `${strike}WKCE`;
					const PEStrike = `${strike}WKPE`;

					const { Open: CEPrice } =
						find(optionsData, { Ticker: CEStrike, 'Date/Time': item['Date/Time'] }) ?? find(optionsData, { Ticker: CEStrike, 'Date/Time': optionsData[index + 1]['Date/Time'] });
					const { Open: PEPrice } =
						find(optionsData, { Ticker: PEStrike, 'Date/Time': item['Date/Time'] }) ?? find(optionsData, { Ticker: PEStrike, 'Date/Time': optionsData[index + 1]['Date/Time'] });
					const { Open: volatility } =
						find(optionsData, { Ticker: 'INDIAVIX', 'Date/Time': item['Date/Time'] }) ?? find(optionsData, { Ticker: 'INDIAVIX', 'Date/Time': optionsData[index + 1]['Date/Time'] });
					const { 'Date/Time': expiryDateTime } = optionsData[findLastIndex(optionsData, (data) => data.Ticker === 'BANKNIFTY')];
					const daysToExpiry = differenceInDays(new Date(getFormattedDate(expiryDateTime.split(' ')[0])), new Date(updatedDate));

					const CEDelta = greeks.getDelta(+item.Open, +strike, daysToExpiry / 365, +volatility / 100, INTEREST_RATE / 100, 'call').toFixed(3) * 100;
					const PEDelta = greeks.getDelta(+item.Open, +strike, daysToExpiry / 365, +volatility / 100, INTEREST_RATE / 100, 'put').toFixed(3) * 100;

					if (Math.abs(CEDelta - PEDelta) < 20) {
						straddleEntryValue = CEPrice + PEPrice;
						console.log(`Sold ${CEStrike} at ₹${CEPrice}. \n Sold ${PEStrike} at ₹${PEPrice}. \n Combined Premium = ₹${straddleEntryValue}`);
					} else {
						console.log('Delta Diff greater than threshold');
					}
				}
			}
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
