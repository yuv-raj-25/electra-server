class ApiResponse {
    constructor(data , message= "success" , statusCode){
        this.statusCode = statusCode;
        this.message = message;
        this.data = data;
        this.success = statusCode < 400;
    }
}

export { ApiResponse };