const regex = /^[^\p{L}\p{N}\s]$/u;
let inputString = "swiperjs.com / plugins - google chrome"
const splitStr = (str) => {
    return str.split(" ").map((ele) => regex.test(ele) ? "" : ele).filter((ele => ele != ""));
}
console.log(splitStr(inputString))
