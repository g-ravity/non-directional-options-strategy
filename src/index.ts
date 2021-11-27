import 'dotenv-safe/config';
import Papa, { ParseResult } from 'papaparse';
import fs from 'fs';
import { homedir } from 'os';
import greeks from 'greeks';
import findLastIndex from 'lodash/findLastIndex';
import find from 'lodash/find';
import differenceInDays from 'date-fns/differenceInDays';

import { FILE_PATH, INTEREST_RATE, STRADDLE_SQ_OFF_TIME, STRADDLE_START_TIME, TICKERS_LIST, TICKER_INFO_MAP, UPDATE_INTERVAL } from './utils/constants';
import { IOptionData } from './types';
import { addZeroPadding, getFormattedDate } from './utils/commonHelpers';

const onParseComplete = (results: ParseResult<IOptionData>) => {
	const optionsData = results.data;
	let tradeDate = '';
	let straddleEntryValue: number;

	optionsData.map((item) => {
		const dateTime = item['Date/Time'] ? item['Date/Time'].split(' ') : undefined;
		if (dateTime && dateTime?.[0] !== tradeDate) tradeDate = dateTime?.[0];

		if (dateTime && item.Ticker && TICKERS_LIST.includes(item.Ticker)) {
			const updatedDate = getFormattedDate(tradeDate);
			const time = dateTime?.[1];
			const currentDateTime = new Date(`${updatedDate} ${time}`);

			const isAfterStartTime = currentDateTime >= new Date(`${updatedDate} ${STRADDLE_START_TIME}`);
			let isBeforeEndTime = true;

			while (isBeforeEndTime && isAfterStartTime) {
				console.log(currentDateTime.getMinutes());
				const dateTimeString = `${currentDateTime.getDate()}-${currentDateTime.getMonth() + 1}-${currentDateTime.getFullYear()} ${addZeroPadding(currentDateTime.getHours())}:${addZeroPadding(
					currentDateTime.getMinutes(),
				)}:${addZeroPadding(currentDateTime.getSeconds())}`;

				isBeforeEndTime = new Date(dateTimeString) <= new Date(`${updatedDate} ${STRADDLE_SQ_OFF_TIME}`);

				const strike = Math.round(+item.Open / 100) * 100;
				const CEStrike = `${item.Ticker}WK${strike}CE`;
				const PEStrike = `${item.Ticker}WK${strike}PE`;

				const { Open: CEPrice } = find(optionsData, { Ticker: CEStrike, 'Date/Time': dateTimeString });
				const { Open: PEPrice } = find(optionsData, { Ticker: PEStrike, 'Date/Time': dateTimeString });
				const { Open: volatility } = find(optionsData, { Ticker: 'INDIAVIX', 'Date/Time': dateTimeString });

				const { 'Date/Time': expiryDateTime } = optionsData[findLastIndex(optionsData, (data) => data.Ticker === 'BANKNIFTY')];
				const daysToExpiry = differenceInDays(new Date(getFormattedDate(expiryDateTime.split(' ')[0])), new Date(updatedDate));

				const CEDelta = Math.abs(greeks.getDelta(+item.Open, +strike, daysToExpiry / 365, +volatility / 100, INTEREST_RATE / 100, 'call').toFixed(3) * 100);
				const PEDelta = Math.abs(greeks.getDelta(+item.Open, +strike, daysToExpiry / 365, +volatility / 100, INTEREST_RATE / 100, 'put').toFixed(3) * 100);

				if (isNaN(straddleEntryValue)) {
					if (Math.abs(CEDelta - PEDelta) < 20) {
						straddleEntryValue = CEPrice + PEPrice;
						console.log(`Sold ${CEStrike} at ₹${CEPrice}.\nSold ${PEStrike} at ₹${PEPrice}.\nCombined Premium = ₹${straddleEntryValue}`);
						console.log(`PNL: ${straddleEntryValue - (CEPrice + PEPrice)}`);
					} else {
						console.log('Could not initiate the straddle as Delta Diff is greater than threshold');
					}
				} else {
					if (Math.abs(CEDelta - PEDelta) >= 20) {
						console.log('Need to do adjustments here!');
					} else {
						console.log(`\nCurrent CE Price: ${CEPrice}\nCurrent PE Price: ${PEPrice}\nTotal Premium: ${CEPrice + PEPrice}`);
						console.log(
							`PNL @ ${addZeroPadding(currentDateTime.getHours())}:${addZeroPadding(currentDateTime.getMinutes())} -> ${(
								(straddleEntryValue - (CEPrice + PEPrice)) *
								TICKER_INFO_MAP[item.Ticker].lotSize
							).toFixed(2)}`,
						);
					}
				}
				console.log(currentDateTime.getMinutes() + UPDATE_INTERVAL);
				currentDateTime.setMinutes(currentDateTime.getMinutes() + UPDATE_INTERVAL);
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
