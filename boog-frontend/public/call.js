const myVid = document.getElementById('my-video');
const peerVid = document.getElementById('peer-video');
const videoBtn = document.getElementById('video-ctl');
const endCallBtn = document.getElementById('endcall');
const audioBtn = document.getElementById('audio-ctl');

const env = {};

if (location.hostname == 'localhost') {
	env.ws = 'ws://localhost:8787';
	env.servers = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] };
} else {
	//TODO
}

let ws;
let localStream;
let remoteStream;
let peerConnection;

const wssend = (data) => ws.send(JSON.stringify(data));

async function handleMessages(e) {
	const msg = JSON.parse(e.data);
	console.log(msg);

	switch (msg.type) {
		case 'join':
			await makeCall();
			break;
		case 'candidate':
			await acceptCandidate(msg.candidate);
			break;
		case 'offer':
			await answerCall(msg.offer);
			break;
		case 'answer':
			await startCall();
			break;
		default:
			console.log('unknown message', msg);
			break;
	}
}

async function acceptCandidate(candidate) {
	try {
		await peerConnection.addIceCandidate(candidate);
	} catch (e) {
		console.error('error adding candidate', e);
	}
}

async function answerCall(offer) {
	await connectToPeer();
	await peerConnection.setRemoteDescription(offer);
	const answer = await peerConnection.createAnswer();
	await peerConnection.setLocalDescription(answer);
	wssend({ type: 'answer', answer });
}

async function connectToPeer() {
	peerConnection = new RTCPeerConnection(env.servers);
	remoteStream = new MediaStream();

	peerVid.srcObject = remoteStream;
	peerVid.classList.remove('hide');
	myVid.classList.add('video-player-secondary');

	if (!localStream) await startLocalPlayback();

	localStream.getTracks().forEach((track) => {
		peerConnection.addTrack(track, localStream);
	});

	peerConnection.ontrack = (e) => {
		e.streams[0].getTracks().forEach((track) => {
			remoteStream.addTrack(track);
		});
	};

	peerConnection.onicecandidate = (e) => {
		if (e.candidate) {
			wssend({ type: 'candidate', candidate: e.candidate });
		}
	};
}

async function makeCall() {
	await connectToPeer();
	const offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);
	wssend({ type: 'offer', offer });
}

async function startCall() {
	await connectToPeer();
	await peerConnection.setRemoteDescription(msg.answer);
}

(async function () {
	const id = new URLSearchParams(window.location.search).get('i');
	if (!id) {
		return;
	}
	ws = new WebSocket(`${env.ws}/{id}`);
	ws.onmessage = handleMessages;
	ws.onopen = () => wssend({ type: 'join' });
	await startLocalPlayback();
})();

async function startLocalPlayback() {
	const config = { video: { width: { min: 1280, ideal: 1920, max: 2560 }, height: { min: 720, ideal: 1080, max: 1440 } }, audio: true };

	localStream = await navigator.mediaDevices.getUserMedia(config);
	myVid.srcObject = localStream;
}
