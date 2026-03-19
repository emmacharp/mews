export const json = (data, status = 200, init = {}) => {
	const headers = new Headers(init.headers || {});
	headers.set("Content-Type", "application/json; charset=utf-8");
	return new Response(JSON.stringify(data), {
		...init,
		status,
		headers,
	});
};

export const text = (body, status = 200, init = {}) => {
	const headers = new Headers(init.headers || {});
	headers.set("Content-Type", "text/plain; charset=utf-8");
	return new Response(body, {
		...init,
		status,
		headers,
	});
};

export const withCors = (response) => {
	const headers = new Headers(response.headers);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Content-Type");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
};

export const handleOptions = () =>
	withCors(new Response(null, {
		status: 204,
	}));
