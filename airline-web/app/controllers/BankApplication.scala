package controllers

import com.patson.data.{AirlineSource, BankSource, CycleSource}
import com.patson.model.{Loan, _}
import com.patson.model.bank.LoanInterestRate
import controllers.AuthenticationObject.AuthenticatedAirline
import javax.inject.Inject
import play.api.data.{Form, Forms}
import play.api.libs.json._
import play.api.mvc.Security.AuthenticatedRequest
import play.api.mvc._

import scala.math.BigDecimal.int2bigDecimal



class BankApplication @Inject()(cc: ControllerComponents) extends AbstractController(cc) {
  implicit object LoanWrites extends Writes[Loan] {
    //case class Loan(airlineId : Int, borrowedAmount : Long, interest : Long, var remainingAmount : Long, creationCycle : Int, loanTerm : Int, var id : Int = 0) extends IdObject
    def writes(loan: Loan): JsValue = JsObject(List(
      "airlineId" -> JsNumber(loan.airlineId),
      "borrowedAmount" -> JsNumber(loan.borrowedAmount),
      "interest" -> JsNumber(loan.interest),
      "remainingAmount" -> JsNumber(loan.remainingAmount),
      "earlyRepaymentFee" -> JsNumber(loan.earlyRepaymentFee),
      "earlyRepayment" -> JsNumber(loan.earlyRepayment),
      "remainingTerm" -> JsNumber(loan.remainingTerm),
      "weeklyPayment" -> JsNumber(loan.weeklyPayment),
      "creationCycle" -> JsNumber(loan.creationCycle),
      "loanTerm" ->  JsNumber(loan.loanTerm),
      "id" -> JsNumber(loan.id)))
  }
  implicit object LoanInterestRateWrites extends Writes[LoanInterestRate] {
    def writes(rate: LoanInterestRate): JsValue = {

      JsObject(List(
        "rate" -> JsNumber(rate.annualRate),
        "cycle" -> JsNumber(rate.cycle)))

    }
  }
  
  case class LoanRequest(requestedAmount: Long, requestedTerm: Int)
  val loanForm = Form(
    Forms.mapping(
      "requestedAmount" -> Forms.longNumber,
      "requestedTerm" -> Forms.number
    )(LoanRequest.apply)(LoanRequest.unapply)
  )

  def viewLoans(airlineId : Int) = AuthenticatedAirline(airlineId) { request : AuthenticatedRequest[Any, Airline] =>
    Ok(Json.toJson(BankSource.loadLoansByAirline(request.user.id)))
  }
  
  def takeOutLoan(airlineId : Int) = AuthenticatedAirline(airlineId) { implicit request =>
    val LoanRequest(requestedAmount, requestedTerm) = loanForm.bindFromRequest.get
    val loanReply = Bank.getMaxLoan(airlineId)
    if (loanReply.rejectionOption.isDefined) {
      BadRequest("Loan rejected [" + requestedAmount + "] reason [" + loanReply.rejectionOption.get + "]")
    } else {
      if (requestedAmount < Bank.MIN_LOAN_AMOUNT) {
        BadRequest("Borrowing [" + requestedAmount + "] which is invalid")
      } else if (requestedAmount > loanReply.maxLoan) {
        BadRequest("Borrowing [" + requestedAmount + "] which is above limit [" + loanReply.maxLoan + "]")
      } else {
        Bank.getLoanOptions(requestedAmount).find( loanOption => loanOption.loanTerm == requestedTerm) match {
          case Some(loan) =>
            BankSource.saveLoan(loan.copy(airlineId = request.user.id, creationCycle = CycleSource.loadCycle()))
            AirlineSource.adjustAirlineBalance(request.user.id, loan.borrowedAmount)
            Ok(Json.toJson(loan))
          case None => BadRequest("Bad loan term [" + requestedTerm + "]")
        }
      }
    }
  }
  
  def getLoanOptions(airlineId : Int, loanAmount : Long) = AuthenticatedAirline(airlineId) { request =>
    val loanReply = Bank.getMaxLoan(request.user.id)
    if (loanAmount <= loanReply.maxLoan) {
      val options = Bank.getLoanOptions(loanAmount)
      Ok(Json.toJson(options))  
    } else {
      BadRequest("Borrowing [" + loanAmount + "] which is above limit [" + loanReply.maxLoan + "]")
    }
    
  }
  
  def getMaxLoan(airlineId : Int) = AuthenticatedAirline(airlineId) { request =>
    val loanReply = Bank.getMaxLoan(request.user.id)
    var result = Json.obj("maxAmount" -> JsNumber(loanReply.maxLoan)).asInstanceOf[JsObject]
    loanReply.rejectionOption.foreach { rejection =>
      result = result + ("rejection" -> JsString(rejection))
    }
    Ok(result)
  }
  
  def repayLoan(airlineId : Int, loanId : Int) = AuthenticatedAirline(airlineId) { request =>
    BankSource.loadLoanById(loanId) match {
      case Some(loan) => { 
        if (loan.airlineId != request.user.id) {
          BadRequest("Cannot repay loan not owned by this airline") 
        } else {
          val balance = request.user.getBalance 
          if (balance < loan.earlyRepayment) {
            BadRequest("Not enough cash to repay this loan")
          } else {
            AirlineSource.adjustAirlineBalance(request.user.id, -1 * loan.earlyRepayment)
            BankSource.deleteLoan(loanId)
            Ok
          }
        }
      }
      case None => NotFound
    }
  }

  def getLoanInterestRates() = Action {
    val currentCycle = CycleSource.loadCycle()
    val rates = BankSource.loadLoanInterestRatesFromCycle(currentCycle - 100).sortBy(_.cycle)
    Ok(Json.toJson(rates))
  }
}
