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
import { logger } from './utils/logger';

const onParseComplete = (results: ParseResult<IOptionData>) => {
	const optionsData = results.data;
	let tradeDate = '';
	let straddleEntryValue: number;

	for (let i = 0; i < optionsData.length; i++) {
		const item = optionsData[i];

		const dateTime = item['Date/Time'] ? item['Date/Time'].split(' ') : undefined;
		if (dateTime && dateTime?.[0] !== tradeDate) tradeDate = dateTime?.[0];

		if (dateTime && item.Ticker && TICKERS_LIST.includes(item.Ticker)) {
			const updatedDate = getFormattedDate(tradeDate);
			const time = dateTime?.[1];
			const currentDateTime = new Date(`${updatedDate} ${time}`);

			const isAfterStartTime = currentDateTime >= new Date(`${updatedDate} ${STRADDLE_START_TIME}`);
			let isBeforeEndTime = true;

			while (isBeforeEndTime && isAfterStartTime) {
				const dateString = `${currentDateTime.getDate()}-${currentDateTime.getMonth() + 1}-${currentDateTime.getFullYear()}`;
				const timeString = `${addZeroPadding(currentDateTime.getHours())}:${addZeroPadding(currentDateTime.getMinutes())}:${addZeroPadding(currentDateTime.getSeconds())}`;
				const dateTimeString = `${dateString} ${timeString}`;

				isBeforeEndTime = new Date(`${getFormattedDate(dateString)} ${timeString}`) < new Date(`${updatedDate} ${STRADDLE_SQ_OFF_TIME}`);

				const strike = Math.round(+item.Open / 100) * 100;
				const CEStrike = `${item.Ticker}WK${strike}CE`;
				const PEStrike = `${item.Ticker}WK${strike}PE`;

				const { Open: CEPrice } = find(optionsData, { Ticker: CEStrike, 'Date/Time': dateTimeString });
				const { Open: PEPrice } = find(optionsData, { Ticker: PEStrike, 'Date/Time': dateTimeString });
				const { Open: volatility } = find(optionsData, { Ticker: 'INDIAVIX', 'Date/Time': dateTimeString });

				const { 'Date/Time': expiryDateTime } = optionsData[findLastIndex(optionsData, (data) => data.Ticker === item.Ticker)];
				const daysToExpiry = differenceInDays(new Date(getFormattedDate(expiryDateTime.split(' ')[0])), new Date(updatedDate));

				const CEDelta = Math.abs(greeks.getDelta(+item.Open, +strike, daysToExpiry / 365, +volatility / 100, INTEREST_RATE / 100, 'call').toFixed(3) * 100);
				const PEDelta = Math.abs(greeks.getDelta(+item.Open, +strike, daysToExpiry / 365, +volatility / 100, INTEREST_RATE / 100, 'put').toFixed(3) * 100);

				if (isNaN(straddleEntryValue)) {
					if (Math.abs(CEDelta - PEDelta) < 20) {
						straddleEntryValue = CEPrice + PEPrice;
						logger.log(`${item.Ticker} Straddle -> Trade Date: ${dateString} @ ${timeString}\n`);
						logger.log(`Sold ${CEStrike} at ₹${CEPrice}.\nSold ${PEStrike} at ₹${PEPrice}.\nCombined Premium = ₹${straddleEntryValue.toFixed(2)}`);
						logger.log(`PNL: ${straddleEntryValue - (CEPrice + PEPrice)}\n`);
					} else {
						logger.log('Could not initiate the straddle as Delta Diff is greater than threshold\n');
					}
				} else {
					if (Math.abs(CEDelta - PEDelta) >= 20) {
						logger.log('Need to do adjustments here!');
					} else {
						logger.log(`Current CE Price: ${CEPrice}\nCurrent PE Price: ${PEPrice}\nCombined Premium = ${(CEPrice + PEPrice).toFixed(2)}`);
						logger.log(
							`PNL @ ${addZeroPadding(currentDateTime.getHours())}:${addZeroPadding(currentDateTime.getMinutes())} -> ${(
								(straddleEntryValue - (CEPrice + PEPrice)) *
								TICKER_INFO_MAP[item.Ticker].lotSize
							).toFixed(2)}\n`,
						);
					}
				}

				currentDateTime.setMinutes(currentDateTime.getMinutes() + UPDATE_INTERVAL);
				const nextDateString = `${currentDateTime.getDate()}-${currentDateTime.getMonth() + 1}-${currentDateTime.getFullYear()}`;
				const index = findLastIndex(optionsData, (data) => data.Ticker === item.Ticker && data['Date/Time'].includes(nextDateString));
				i = index;
			}

			straddleEntryValue = undefined;
		}
	}

	console.log('DONE! 🎉🎉 🎊🎊');
};

fs.readFile(`${homedir}/${FILE_PATH}`, 'utf8', (err, data) => {
	if (err) {
		logger.error(err);
		return;
	}

	Papa.parse<IOptionData>(data, {
		header: true,
		dynamicTyping: true,
		complete: onParseComplete,
		error: (err: Error) => logger.log('Something went wrong while parsing! \n', err),
		fastMode: true,
	});
});
