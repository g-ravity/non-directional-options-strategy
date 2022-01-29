export class Response {
	constructor(data, message, status) {
		this.message = message;
		this.status = status;
		this.data = data;
		this.res = null;
	}

	mutate(fn) {
		fn(this);
		return this;
	}

	eligibleProperties = ['data', 'message', 'status', 'error'];

	captureOrignalResponse(res) {
		return this.mutate((self) => {
			self.res = res;
		});
	}

	send() {
		if (!this.res.json) {
			throw new Error('Cannot Call send Response before create');
		}
		this.res.json(pickWrapper(this.eligibleProperties, this));
	}

	success() {
		return this.mutate((self) => {
			self.status = 200;
			self.message = 'Success';
		});
	}

	nocontent() {
		return this.mutate((self) => {
			self.status = 204;
			self.message = 'No Content';
		});
	}

	forbidden(error) {
		return this.mutate((self) => {
			self.status = 403;
			self.message = 'Not Allowed';
			self.error = error;
			delete self.data;
		});
	}

	unauthorized(error) {
		return this.mutate((self) => {
			self.status = 401;
			self.message = 'Unauthorized';
			self.error = error;
			delete self.data;
		});
	}

	notfound(error) {
		return this.mutate((self) => {
			self.status = 404;
			self.message = 'Not Found';
			self.error = error;
			delete self.data;
		});
	}

	badrequest(error) {
		return this.mutate((self) => {
			self.status = 400;
			self.message = 'Bad Request';
			self.error = error;
			delete self.data;
		});
	}

	internalerror(error) {
		return this.mutate((self) => {
			self.status = 500;
			self.message = 'Internal Server Error';
			self.error = error;
			delete self.data;
		});
	}
}

const upgradeResponse = (app) =>
	app.use((_req, res, next) => {
		res.create = (data) => new Response(data, null, null).captureOrignalResponse(res);
		next();
	});

export default upgradeResponse;
