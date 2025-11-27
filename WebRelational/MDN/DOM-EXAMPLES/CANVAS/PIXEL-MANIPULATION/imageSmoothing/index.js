const imageData = new Image();
imageData.crossOrigin = "anonymous";
imageData.src = "../assets/cup.png";

imageData.addEventListener("load", function(){
    handleDraw(imageData);
});
function handleDraw(imageData){
    const canvas = document.getElementById("canvas");
    const canvas2d_ = canvas.getContext("2d");
    canvas2d_.drawImage(imageData,0, 0);

    const smoothed2d_ = document.getElementById("smoothed-zoom").getContext("2d");
    smoothed2d_.imageSmoothingEnabled = true;
    smoothed2d_.mozImageSmoothingEnabled = true;
    smoothed2d_.webkitImageSmoothingEnabled = true;
    smoothed2d_.msImageSmoothingEnabled = true;
    const pixelated2d_ = document.getElementById("pixelated-zoom").getContext("2d");
    pixelated2d_.imageSmoothingEnabled = false;
    pixelated2d_.mozImageSmoothingEnabled = false;
    pixelated2d_.webkitImageSmoothingEnabled = false;
    pixelated2d_.msImageSmoothingEnabled = false;

    const handleZoom = function(canvas2d_, x, y){
        canvas2d_.drawImage(canvas,
									Math.min(Math.max(0, x - 5), imageData.width - 10),
									Math.min(Math.max(0, y - 5), imageData.height - 10),
									10, 10,
									0, 0,
									200, 200);
    }
    canvas.addEventListener("mousemove", function(event){
        const x = event.offsetX;
		const y = event.offsetY;
        handleZoom(smoothed2d_,x,y);
        handleZoom(pixelated2d_,x,y);
    });
}

